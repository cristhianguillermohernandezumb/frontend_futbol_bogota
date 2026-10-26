import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { Alineacion, EquipoDePartido, JugadorInscrito, Modalidad, Partido, Torneo } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';

/** Titulares por modalidad (mismo calculo que valida el backend). */
const TITULARES: Record<Modalidad, number> = { FUTBOL_5: 5, FUTBOL_7: 7, FUTBOL_8: 8, FUTBOL_11: 11 };

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

@Component({
  selector: 'app-alineacion-equipo',
  imports: [FormsModule],
  templateUrl: './alineacion-equipo.html',
  styleUrl: './alineacion-equipo.css',
})
export class AlineacionEquipo {
  readonly partido = input.required<Partido>();
  readonly torneo = input.required<Torneo>();
  readonly equipo = input.required<EquipoDePartido>();
  /** Alineacion de los dos equipos del partido; aqui se filtra la del equipo. */
  readonly alineacion = input.required<Alineacion[]>();
  readonly editable = input.required<boolean>();
  readonly cambio = output<void>();

  private readonly organizador = inject(OrganizadorService);

  protected readonly plantilla = signal<JugadorInscrito[]>([]);
  protected readonly cargando = signal(true);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);

  protected readonly idElegido = signal(0);
  protected readonly comoTitular = signal(true);
  protected readonly minutos = signal<Record<number, number>>({});

  protected readonly mia = computed(() =>
    this.alineacion()
      .filter((a) => a.idEquipo === this.equipo().idEquipo)
      .sort((a, b) => (a.titular === b.titular ? a.nombreJugador.localeCompare(b.nombreJugador) : a.titular === 'S' ? -1 : 1)),
  );
  protected readonly titulares = computed(() => this.mia().filter((a) => a.titular === 'S').length);
  protected readonly maxTitulares = computed(() => TITULARES[this.torneo().modalidad]);
  protected readonly cupoLleno = computed(() => this.titulares() >= this.maxTitulares());

  protected readonly disponibles = computed(() => {
    const usados = new Set(this.alineacion().map((a) => a.idJugador));
    return this.plantilla().filter((j) => !usados.has(j.idJugador));
  });

  /** Antes de empezar se arma la alineacion; ya empezado, solo se anotan minutos jugados. */
  protected readonly sinEmpezar = computed(() => ['PROGRAMADO', 'APLAZADO'].includes(this.partido().estado));
  protected readonly finalizado = computed(() => this.partido().estado === 'FINALIZADO');

  constructor() {
    effect(() => {
      const t = this.torneo().idTorneo;
      const e = this.equipo().idEquipo;
      untracked(() => this.cargarPlantilla(t, e));
    });
    // Si el cupo de titulares se llena, lo natural es agregar al siguiente como suplente.
    effect(() => {
      if (this.cupoLleno()) {
        untracked(() => this.comoTitular.set(false));
      }
    });
  }

  private cargarPlantilla(idTorneo: number, idEquipo: number): void {
    this.cargando.set(true);
    this.organizador.jugadoresDeEquipo(idTorneo, idEquipo).subscribe({
      next: (l) => {
        this.plantilla.set(l);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.cargando.set(false);
      },
    });
  }

  protected agregar(): void {
    const idJugador = Number(this.idElegido());
    if (!idJugador) {
      this.mensaje.set({ tipo: 'error', texto: 'Elige un jugador.' });
      return;
    }
    this.ejecutar(
      this.organizador.agregarAlineacion(
        this.partido().idPartido,
        this.equipo().idEquipo,
        idJugador,
        this.comoTitular() && !this.cupoLleno(),
      ),
      'Jugador agregado a la alineación.',
      () => this.idElegido.set(0),
    );
  }

  protected alternarTitular(a: Alineacion): void {
    this.ejecutar(
      this.organizador.actualizarAlineacion(a.idPartido, a.idEquipo, a.idJugador, { titular: a.titular !== 'S' }),
      `${a.nombreJugador} ahora es ${a.titular === 'S' ? 'suplente' : 'titular'}.`,
    );
  }

  protected quitar(a: Alineacion): void {
    this.ejecutar(
      this.organizador.quitarAlineacion(a.idPartido, a.idEquipo, a.idJugador),
      `${a.nombreJugador} salió de la alineación.`,
    );
  }

  protected valorMinutos(a: Alineacion): number {
    return this.minutos()[a.idJugador] ?? a.minutosJugados;
  }

  protected editarMinutos(a: Alineacion, valor: string): void {
    this.minutos.update((m) => ({ ...m, [a.idJugador]: Number(valor) }));
  }

  protected guardarMinutos(a: Alineacion): void {
    this.ejecutar(
      this.organizador.actualizarAlineacion(a.idPartido, a.idEquipo, a.idJugador, { minutos: this.valorMinutos(a) }),
      `Minutos de ${a.nombreJugador} guardados.`,
      () =>
        this.minutos.update((m) => {
          const { [a.idJugador]: _quitado, ...resto } = m;
          return resto;
        }),
    );
  }

  protected minutosCambiados(a: Alineacion): boolean {
    return this.valorMinutos(a) !== a.minutosJugados;
  }

  private ejecutar(accion: Observable<unknown>, exito: string, alTerminar?: () => void): void {
    this.trabajando.set(true);
    this.mensaje.set(null);
    accion.subscribe({
      next: () => {
        this.mensaje.set({ tipo: 'ok', texto: exito });
        this.trabajando.set(false);
        alTerminar?.();
        this.cambio.emit();
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.trabajando.set(false);
      },
    });
  }
}
