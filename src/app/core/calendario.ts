/** Un partido de la fase de grupos que todavia no tiene fecha ni cancha. */
export interface Emparejamiento {
  jornada: number;
  local: number;
  visitante: number;
}

/**
 * Todos contra todos de un grupo (metodo del circulo): cada equipo juega una vez contra cada uno de los demas.
 * Un grupo de 4 da 3 jornadas de 2 partidos; con numero impar de equipos a cada jornada le sobra uno (descansa).
 * El local se va alternando para que nadie juegue siempre de local.
 */
export function todosContraTodos(ids: number[]): Emparejamiento[] {
  const equipos: (number | null)[] = [...ids];
  if (equipos.length % 2 === 1) {
    equipos.push(null);
  }
  const n = equipos.length;
  const partidos: Emparejamiento[] = [];
  for (let ronda = 0; ronda < n - 1; ronda++) {
    for (let i = 0; i < n / 2; i++) {
      const a = equipos[i];
      const b = equipos[n - 1 - i];
      if (a === null || b === null) {
        continue;
      }
      const invertir = (ronda + i) % 2 === 1;
      partidos.push({ jornada: ronda + 1, local: invertir ? b : a, visitante: invertir ? a : b });
    }
    // El primero se queda fijo y los demas giran una posicion.
    equipos.splice(1, 0, equipos.pop() as number | null);
  }
  return partidos;
}

/** Clave de un cruce sin importar quien es local y quien visitante. */
export function clavePareja(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
