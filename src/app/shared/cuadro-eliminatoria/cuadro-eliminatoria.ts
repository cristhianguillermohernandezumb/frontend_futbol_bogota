import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { Cruce, PartidoConEquipos } from '../../core/models';
import { RONDA_32AVOS, partidoDeCruce } from '../../core/eliminatorias';
import { EscudoEquipo } from '../escudo-equipo/escudo-equipo';

interface Equipo {
  idEquipo: number;
  nombre: string;
  goles: number | null;
}

interface Tarjeta {
  fila: number;
  alto: number;
  par: 'arriba' | 'abajo' | null;
  conecta: boolean;
  etiqueta: string;
  equipos: [Equipo, Equipo] | null;
  fecha: string | null;
  estado: string | null;
}

interface Columna {
  titulo: string;
  tarjetas: Tarjeta[];
}

const RONDAS = ['32avos de final', 'Octavos de final', 'Cuartos de final', 'Semifinales', 'Final'];

/**
 * Cuadro de eliminatoria "en flujo": cada cruce de 32avos con el escudo y el nombre de sus equipos y las rondas
 * siguientes por definir. Los marcadores aparecen cuando el partido de ese cruce ya empezo.
 */
@Component({
  selector: 'app-cuadro-eliminatoria',
  imports: [DatePipe, EscudoEquipo],
  templateUrl: './cuadro-eliminatoria.html',
  styleUrl: './cuadro-eliminatoria.css',
})
export class CuadroEliminatoria {
  readonly cruces = input.required<Cruce[]>();
  readonly partidos = input<PartidoConEquipos[]>([]);

  protected readonly columnas = computed<Columna[]>(() => {
    const total = RONDA_32AVOS.cruces;
    const ordenados = [...this.cruces()].sort((a, b) => a.orden - b.orden);
    const columnas: Columna[] = [];
    for (let r = 0; r < RONDAS.length; r++) {
      const cantidad = total / 2 ** r;
      const alto = 2 ** r;
      const tarjetas: Tarjeta[] = [];
      for (let i = 0; i < cantidad; i++) {
        const cruce = r === 0 ? ordenados.find((c) => c.orden === i + 1) : undefined;
        const partido = cruce ? partidoDeCruce(this.partidos(), cruce) : undefined;
        const marcador = !!partido && (partido.estado === 'EN_JUEGO' || partido.estado === 'FINALIZADO');
        tarjetas.push({
          fila: i * alto + 1,
          alto,
          par: cantidad > 1 ? (i % 2 === 0 ? 'arriba' : 'abajo') : null,
          conecta: r > 0,
          etiqueta: r === 0 ? `Cruce ${i + 1}` : r === RONDAS.length - 1 ? 'Final' : `${RONDAS[r]} · ${i + 1}`,
          equipos: cruce
            ? [
                { idEquipo: cruce.idLocal, nombre: cruce.nombreLocal, goles: marcador ? partido.golesLocal : null },
                { idEquipo: cruce.idVisitante, nombre: cruce.nombreVisitante, goles: marcador ? partido.golesVisitante : null },
              ]
            : null,
          fecha: partido?.fechaHora ?? null,
          estado: partido?.estado ?? null,
        });
      }
      columnas.push({ titulo: RONDAS[r], tarjetas });
    }
    return columnas;
  });

  protected readonly filas = RONDA_32AVOS.cruces;
}
