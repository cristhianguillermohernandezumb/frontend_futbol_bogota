import { PartidoConEquipos } from './models';

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
