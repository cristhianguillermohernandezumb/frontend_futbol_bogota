import { GrupoConEquipos, Posicion } from './models';

/** Cuantos terceros pasan de ronda (12 grupos: 24 primeros y segundos + 8 terceros = 32 equipos). */
export const MEJORES_TERCEROS = 8;

export interface FilaGrupo {
  idEquipo: number;
  nombre: string;
  pos: Posicion | null;
}

export interface TablaGrupo {
  idGrupo: number;
  letra: string;
  filas: FilaGrupo[];
  terminado: boolean;
}

export interface Tercero extends FilaGrupo {
  letra: string;
  puesto: number;
  pasa: boolean;
}

export interface Clasificados {
  directos: { letra: string; primero: FilaGrupo; segundo: FilaGrupo }[];
  terceros: Tercero[];
  total: number;
  cupoTerceros: number;
}

export interface EquipoClasificado {
  idEquipo: number;
  nombre: string;
  letra: string;
  /** Puesto con el que clasifico en su grupo (1.º, 2.º o 3.º). */
  puesto: number;
}

/**
 * Cada grupo con su tabla: los equipos del grupo ordenados segun la tabla de posiciones del torneo
 * (los equipos solo juegan dentro de su grupo, asi que sus numeros son los del grupo).
 */
export function calcularTablasDeGrupos(grupos: GrupoConEquipos[], posiciones: Posicion[]): TablaGrupo[] {
  const porEquipo = new Map(posiciones.map((p) => [p.idEquipo, p]));
  return grupos.map((g) => {
    const filas = g.equipos
      .map((e) => ({ idEquipo: e.idEquipo, nombre: e.nombreEquipo, pos: porEquipo.get(e.idEquipo) ?? null }))
      .sort(
        (a, b) =>
          (a.pos?.posicion ?? Number.MAX_SAFE_INTEGER) - (b.pos?.posicion ?? Number.MAX_SAFE_INTEGER) ||
          a.nombre.localeCompare(b.nombre),
      );
    // La fase de grupos termina cuando todos jugaron contra todos los demas del grupo.
    const terminado = filas.length > 1 && filas.every((f) => (f.pos?.partidosJugados ?? 0) >= filas.length - 1);
    return { idGrupo: g.idGrupo, letra: g.letra, filas, terminado };
  });
}

type ConPuntos = { nombre: string; pos: { puntos: number; diferenciaGoles: number; golesFavor: number } | null };

function ordenarPorPuntos(a: ConPuntos, b: ConPuntos): number {
  return (
    (b.pos?.puntos ?? 0) - (a.pos?.puntos ?? 0) ||
    (b.pos?.diferenciaGoles ?? 0) - (a.pos?.diferenciaGoles ?? 0) ||
    (b.pos?.golesFavor ?? 0) - (a.pos?.golesFavor ?? 0) ||
    a.nombre.localeCompare(b.nombre)
  );
}

/**
 * Clasificados a la siguiente ronda: primero y segundo de cada grupo mas los mejores terceros
 * (puntos, diferencia de goles, goles a favor y nombre). Solo se definen cuando todos los grupos terminaron.
 * Esta es la regla de grupos de 4; las de grupos de 6 y de 12 se agregaran aqui cuando se definan.
 */
export function calcularClasificados(tablas: TablaGrupo[]): Clasificados | null {
  if (tablas.length === 0 || !tablas.every((g) => g.terminado)) {
    return null;
  }
  const directos = tablas
    .filter((g) => g.filas.length >= 2)
    .map((g) => ({ letra: g.letra, primero: g.filas[0], segundo: g.filas[1] }));
  const terceros = tablas
    .filter((g) => g.filas.length >= 3)
    .map((g) => ({ letra: g.letra, ...g.filas[2] }))
    .sort(ordenarPorPuntos)
    .map((f, i) => ({ ...f, puesto: i + 1, pasa: i < MEJORES_TERCEROS }));
  const total = directos.length * 2 + terceros.filter((f) => f.pasa).length;
  return { directos, terceros, total, cupoTerceros: Math.min(MEJORES_TERCEROS, terceros.length) };
}

/** Los equipos que pasan de ronda, en una sola lista (1.os, 2.os y mejores terceros). */
export function listarClasificados(c: Clasificados): EquipoClasificado[] {
  return [
    ...c.directos.map((d) => ({ idEquipo: d.primero.idEquipo, nombre: d.primero.nombre, letra: d.letra, puesto: 1 })),
    ...c.directos.map((d) => ({ idEquipo: d.segundo.idEquipo, nombre: d.segundo.nombre, letra: d.letra, puesto: 2 })),
    ...c.terceros.filter((t) => t.pasa).map((t) => ({ idEquipo: t.idEquipo, nombre: t.nombre, letra: t.letra, puesto: 3 })),
  ];
}
