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
export const RONDAS_ELIMINATORIA = [
  { fase: '32avos', jornada: 4, cruces: 16, titulo: '32avos de final', etiqueta: 'Cruce' },
  { fase: 'octavos', jornada: 5, cruces: 8, titulo: 'Octavos de final', etiqueta: 'Octavos' },
  { fase: 'cuartos', jornada: 6, cruces: 4, titulo: 'Cuartos de final', etiqueta: 'Cuartos' },
  { fase: 'semifinales', jornada: 7, cruces: 2, titulo: 'Semifinales', etiqueta: 'Semifinal' },
  { fase: 'final', jornada: 8, cruces: 1, titulo: 'Final', etiqueta: 'Final' },
] as const;

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
  ronda: number,
  orden: number,
  idCruce: number | null,
  local: EquipoRef | null,
  visitante: EquipoRef | null,
  partidos: PartidoConEquipos[],
  penales: Penales[],
): CruceCalculado {
  const partido = local && visitante ? partidoDeCruce(partidos, { idLocal: local.idEquipo, idVisitante: visitante.idEquipo }, RONDAS_ELIMINATORIA[ronda].fase) : undefined;
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

/** Todas las rondas del cuadro a partir de los cruces de 32avos, los partidos y las tandas de penales. */
export function calcularRondas(cruces: Cruce[], partidos: PartidoConEquipos[], penales: Penales[]): CruceCalculado[][] {
  const rondas: CruceCalculado[][] = [];
  const primera: CruceCalculado[] = [];
  for (let i = 0; i < RONDAS_ELIMINATORIA[0].cruces; i++) {
    const c = cruces.find((x) => x.orden === i + 1);
    primera.push(
      calcularCruce(
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
  for (let r = 1; r < RONDAS_ELIMINATORIA.length; r++) {
    const previa = rondas[r - 1];
    const actual: CruceCalculado[] = [];
    for (let i = 0; i < RONDAS_ELIMINATORIA[r].cruces; i++) {
      actual.push(calcularCruce(r, i + 1, null, previa[2 * i].ganador, previa[2 * i + 1].ganador, partidos, penales));
    }
    rondas.push(actual);
  }
  return rondas;
}
