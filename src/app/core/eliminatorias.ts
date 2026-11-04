import { Cruce, PartidoConEquipos, Penales } from './models';

/** Primera ronda eliminatoria: 32 equipos, 16 cruces. */
export const RONDA_32AVOS = {
  codigo: '32AVOS',
  /** Valor del campo fase con el que se guardan sus partidos. */
  fase: '32avos',
  /** Las 3 jornadas de la fase de grupos ya pasaron: la eliminatoria empieza en la 4. */
  jornada: 4,
  cruces: 16,
  titulo: '32avos de final',
} as const;

export const FASE_GRUPOS = 'Grupos';

export function esFase(p: { fase: string }, fase: string): boolean {
  return (p.fase ?? '').trim().toLowerCase() === fase.toLowerCase();
}

/** La fase de grupos termino cuando hay partidos de grupos y todos estan FINALIZADOS. */
export function faseDeGruposTerminada(partidos: PartidoConEquipos[]): boolean {
  const grupos = partidos.filter((p) => esFase(p, FASE_GRUPOS));
  return grupos.length > 0 && grupos.every((p) => p.estado === 'FINALIZADO');
}

/** El partido ya creado para un cruce (misma fase y mismos equipos), si existe. */
export function partidoDeCruce(
  partidos: PartidoConEquipos[],
  cruce: { idLocal: number; idVisitante: number },
  fase: string = RONDA_32AVOS.fase,
): PartidoConEquipos | undefined {
  return partidos.find((p) => esFase(p, fase) && p.idLocal === cruce.idLocal && p.idVisitante === cruce.idVisitante);
}

/** Rondas del cuadro: 32 equipos -> 16 cruces -> ... -> final. Cada una guarda sus partidos con su fase y jornada. */
export interface Ronda {
  /** Codigo con el que el backend guarda los cruces de la primera ronda. */
  codigo: string;
  /** Valor del campo fase con el que se guardan sus partidos. */
  fase: string;
  jornada: number;
  cruces: number;
  titulo: string;
  etiqueta: string;
}

const TODAS_LAS_RONDAS: Ronda[] = [
  { codigo: '32AVOS', fase: '32avos', jornada: 4, cruces: 16, titulo: '32avos de final', etiqueta: 'Cruce' },
  { codigo: 'OCTAVOS', fase: 'octavos', jornada: 5, cruces: 8, titulo: 'Octavos de final', etiqueta: 'Octavos' },
  { codigo: 'CUARTOS', fase: 'cuartos', jornada: 6, cruces: 4, titulo: 'Cuartos de final', etiqueta: 'Cuartos' },
  { codigo: 'SEMIFINALES', fase: 'semifinales', jornada: 7, cruces: 2, titulo: 'Semifinales', etiqueta: 'Semifinal' },
  { codigo: 'FINAL', fase: 'final', jornada: 8, cruces: 1, titulo: 'Final', etiqueta: 'Final' },
];

/** Formato de 48 equipos (el de siempre): 12 grupos de 4, la eliminatoria arranca en 32avos. */
export const RONDAS_ELIMINATORIA: Ronda[] = TODAS_LAS_RONDAS;

/**
 * Como se juega un torneo segun su maximo de equipos (se elige al crearlo):
 * - 48 equipos: 12 grupos de 4; pasan 2 por grupo + los 8 mejores terceros = 32 -> 32avos de final.
 * - 24 equipos: 6 grupos de 4; pasan 2 por grupo + los 4 mejores terceros = 16 -> octavos de final.
 */
export interface FormatoTorneo {
  equipos: number;
  grupos: number;
  tamanoGrupo: number;
  /** Cuantos terceros pasan de ronda. */
  terceros: number;
  /** Equipos que llegan a la eliminatoria. */
  clasificados: number;
  /** Rondas de la eliminatoria, desde la primera hasta la final; la jornada empieza en 4 (despues de los grupos). */
  rondas: Ronda[];
  primera: Ronda;
  /** Descripcion corta para mostrar en pantalla. */
  descripcion: string;
}

function crearFormato(equipos: number, grupos: number, terceros: number, desde: number): FormatoTorneo {
  const rondas = TODAS_LAS_RONDAS.slice(desde).map((r, i) => ({ ...r, jornada: 4 + i }));
  return {
    equipos,
    grupos,
    tamanoGrupo: 4,
    terceros,
    clasificados: grupos * 2 + terceros,
    rondas,
    primera: rondas[0],
    descripcion: `${equipos} equipos · ${grupos} grupos de 4 · pasan ${grupos * 2 + terceros} (los 2 primeros de cada grupo y los ${terceros} mejores terceros)`,
  };
}

export const FORMATO_48 = crearFormato(48, 12, 8, 0);
export const FORMATO_24 = crearFormato(24, 6, 4, 1);

/** Formatos que se pueden elegir al crear un torneo. */
export const FORMATOS_TORNEO: FormatoTorneo[] = [FORMATO_24, FORMATO_48];

export function formatoDe(maxEquipos: number | null | undefined): FormatoTorneo {
  return maxEquipos === 24 ? FORMATO_24 : FORMATO_48;
}

export interface EquipoRef {
  idEquipo: number;
  nombre: string;
}

/** Un cruce del cuadro. En las rondas siguientes a 32avos los equipos salen de los ganadores de la ronda anterior. */
export interface CruceCalculado {
  ronda: number;
  orden: number;
  /** id del cruce guardado (solo en 32avos). */
  idCruce: number | null;
  local: EquipoRef | null;
  visitante: EquipoRef | null;
  partido: PartidoConEquipos | undefined;
  tanda: Penales | undefined;
  /** Quien paso de ronda: ganador por goles o, si hubo empate, por penales. null mientras no termine. */
  ganador: EquipoRef | null;
}

function calcularCruce(
  rondas: Ronda[],
  ronda: number,
  orden: number,
  idCruce: number | null,
  local: EquipoRef | null,
  visitante: EquipoRef | null,
  partidos: PartidoConEquipos[],
  penales: Penales[],
): CruceCalculado {
  const partido = local && visitante ? partidoDeCruce(partidos, { idLocal: local.idEquipo, idVisitante: visitante.idEquipo }, rondas[ronda].fase) : undefined;
  const tanda = partido ? penales.find((x) => x.idPartido === partido.idPartido && x.tiros.length > 0) : undefined;
  let ganador: EquipoRef | null = null;
  if (partido && partido.estado === 'FINALIZADO' && local && visitante) {
    if (partido.golesLocal !== partido.golesVisitante) {
      ganador = partido.golesLocal > partido.golesVisitante ? local : visitante;
    } else if (tanda?.ganador) {
      ganador = tanda.ganador === 'LOCAL' ? local : visitante;
    }
  }
  return { ronda, orden, idCruce, local, visitante, partido, tanda, ganador };
}

/** Todas las rondas del cuadro a partir de los cruces de la primera ronda, los partidos y las tandas de penales. */
export function calcularRondas(
  cruces: Cruce[],
  partidos: PartidoConEquipos[],
  penales: Penales[],
  formato: FormatoTorneo = FORMATO_48,
): CruceCalculado[][] {
  const rondasDef = formato.rondas;
  const rondas: CruceCalculado[][] = [];
  const primera: CruceCalculado[] = [];
  for (let i = 0; i < rondasDef[0].cruces; i++) {
    const c = cruces.find((x) => x.orden === i + 1);
    primera.push(
      calcularCruce(
        rondasDef,
        0,
        i + 1,
        c?.idCruce ?? null,
        c ? { idEquipo: c.idLocal, nombre: c.nombreLocal } : null,
        c ? { idEquipo: c.idVisitante, nombre: c.nombreVisitante } : null,
        partidos,
        penales,
      ),
    );
  }
  rondas.push(primera);
  for (let r = 1; r < rondasDef.length; r++) {
    const previa = rondas[r - 1];
    const actual: CruceCalculado[] = [];
    for (let i = 0; i < rondasDef[r].cruces; i++) {
      actual.push(calcularCruce(rondasDef, r, i + 1, null, previa[2 * i].ganador, previa[2 * i + 1].ganador, partidos, penales));
    }
    rondas.push(actual);
  }
  return rondas;
}
