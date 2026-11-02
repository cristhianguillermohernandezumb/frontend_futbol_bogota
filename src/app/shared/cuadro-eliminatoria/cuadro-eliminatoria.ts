import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { Cruce, PartidoConEquipos, Penales } from '../../core/models';
import { RONDAS_ELIMINATORIA, calcularRondas } from '../../core/eliminatorias';
import { EscudoEquipo } from '../escudo-equipo/escudo-equipo';

interface Equipo {
  idEquipo: number | null;
  nombre: string;
  goles: number | null;
  /** Penales convertidos, si el partido se definio en tanda. */
  penales: number | null;
  gana: boolean;
}

interface Tarjeta {
  fila: number;
  alto: number;
  par: 'arriba' | 'abajo' | null;
  conecta: boolean;
  etiqueta: string;
  equipos: [Equipo, Equipo] | null;
  /** Equipo que paso de ronda (o campeon, en la final). */
  pasa: string | null;
  fecha: string | null;
  estado: string | null;
}

interface Columna {
  titulo: string;
  tarjetas: Tarjeta[];
}

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
  readonly penales = input<Penales[]>([]);

  protected readonly rondas = computed(() => calcularRondas(this.cruces(), this.partidos(), this.penales()));

  protected readonly campeon = computed(() => this.rondas()[RONDAS_ELIMINATORIA.length - 1][0].ganador);

  protected readonly columnas = computed<Columna[]>(() =>
    this.rondas().map((cruces, r) => {
      const cantidad = cruces.length;
      const alto = 2 ** r;
      const ronda = RONDAS_ELIMINATORIA[r];
      return {
        titulo: ronda.titulo,
        tarjetas: cruces.map((c, i): Tarjeta => {
          const marcador = !!c.partido && (c.partido.estado === 'EN_JUEGO' || c.partido.estado === 'FINALIZADO');
          const gana = (id: number | undefined) => !!c.ganador && c.ganador.idEquipo === id;
          const lado = (eq: typeof c.local, goles: number | undefined, pen: number | undefined): Equipo => ({
            idEquipo: eq?.idEquipo ?? null,
            nombre: eq?.nombre ?? 'Por definir',
            goles: marcador && eq ? (goles ?? null) : null,
            penales: marcador && eq && c.tanda ? (pen ?? null) : null,
            gana: gana(eq?.idEquipo),
          });
          return {
            fila: i * alto + 1,
            alto,
            par: cantidad > 1 ? (i % 2 === 0 ? 'arriba' : 'abajo') : null,
            conecta: r > 0,
            etiqueta: r === 0 ? `Cruce ${i + 1}` : r === RONDAS_ELIMINATORIA.length - 1 ? 'Final' : `${ronda.titulo} · ${i + 1}`,
            equipos:
              c.local || c.visitante
                ? [lado(c.local, c.partido?.golesLocal, c.tanda?.golesLocal), lado(c.visitante, c.partido?.golesVisitante, c.tanda?.golesVisitante)]
                : null,
            pasa: c.ganador?.nombre ?? null,
            fecha: c.partido?.fechaHora ?? null,
            estado: c.partido?.estado ?? null,
          };
        }),
      };
    }),
  );

  protected readonly filas = RONDAS_ELIMINATORIA[0].cruces;
}
