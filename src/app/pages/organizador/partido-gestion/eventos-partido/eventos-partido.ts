import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { Alineacion, EquipoDePartido, EventoPartido, Partido, TipoEvento } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

const TIPOS: { valor: TipoEvento; texto: string }[] = [
  { valor: 'GOL', texto: 'Gol' },
  { valor: 'AUTOGOL', texto: 'Autogol' },
  { valor: 'AMARILLA', texto: 'Amarilla' },
  { valor: 'ROJA', texto: 'Roja' },
  { valor: 'FALTA', texto: 'Falta' },
];

@Component({
  selector: 'app-eventos-partido',
  imports: [FormsModule],
  templateUrl: './eventos-partido.html',
  styleUrl: './eventos-partido.css',
})
export class EventosPartido implements OnInit {
  readonly partido = input.required<Partido>();
  readonly local = input.required<EquipoDePartido>();
  readonly visitante = input.required<EquipoDePartido>();
  readonly alineacion = input.required<Alineacion[]>();
  readonly editable = input.required<boolean>();
  /** Avisa que cambio el marcador, para que la pagina vuelva a pedir el partido. */
  readonly cambio = output<void>();

  private readonly organizador = inject(OrganizadorService);

  protected readonly tipos = TIPOS;
  protected readonly eventos = signal<EventoPartido[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly borrando = signal<number | null>(null);

  protected readonly tipo = signal<TipoEvento>('GOL');
  protected readonly idEquipo = signal(0);
  protected readonly idJugador = signal(0);
  protected readonly minuto = signal<number | null>(null);
  protected readonly intento = signal(false);

  protected readonly enJuego = computed(() => this.partido().estado === 'EN_JUEGO');

  protected readonly ordenados = computed(() =>
    [...this.eventos()].sort((a, b) => a.minuto - b.minuto || a.idEvento - b.idEvento),
  );

  /** Jugadores del equipo elegido que siguen en cancha (a los expulsados el backend ya no les acepta eventos). */
  protected readonly jugadores = computed(() => {
    const expulsados = new Set(this.eventos().filter((e) => e.tipoEvento === 'ROJA').map((e) => e.idJugador));
    return this.alineacion()
      .filter((a) => a.idEquipo === this.idEquipo() && !expulsados.has(a.idJugador))
      .sort((a, b) => (a.titular === b.titular ? a.nombreJugador.localeCompare(b.nombreJugador) : a.titular === 'S' ? -1 : 1));
  });

  constructor() {
    // El equipo local queda elegido por defecto, y se cambia solo si el elegido deja de existir.
    effect(() => {
      const l = this.local().idEquipo;
      const v = this.visitante().idEquipo;
      untracked(() => {
        if (this.idEquipo() !== l && this.idEquipo() !== v) {
          this.idEquipo.set(l);
        }
      });
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.organizador.eventos(this.partido().idPartido).subscribe({
      next: (l) => {
        this.eventos.set(l);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected elegirEquipo(id: number): void {
    this.idEquipo.set(id);
    this.idJugador.set(0);
  }

  protected nombreEquipo(id: number): string {
    return id === this.local().idEquipo ? this.local().nombreEquipo : this.visitante().nombreEquipo;
  }

  protected etiqueta(t: TipoEvento): string {
    return TIPOS.find((x) => x.valor === t)?.texto ?? t;
  }

  protected claseTipo(t: TipoEvento): string {
    return `tipo tipo-${t.toLowerCase()}`;
  }

  protected registrar(): void {
    this.intento.set(true);
    const m = this.minuto();
    if (!Number(this.idJugador()) || m === null || m < 0 || m > 120) {
      return;
    }
    const jugador = this.jugadores().find((j) => j.idJugador === Number(this.idJugador()));
    this.ejecutar(
      this.organizador.registrarEvento({
        minuto: Number(m),
        tipoEvento: this.tipo(),
        idPartido: this.partido().idPartido,
        idEquipo: this.idEquipo(),
        idTorneo: this.partido().idTorneo,
        idJugador: Number(this.idJugador()),
      }),
      `${this.etiqueta(this.tipo())} de ${jugador?.nombreJugador ?? 'jugador'} registrado.`,
      () => {
        this.idJugador.set(0);
        this.intento.set(false);
      },
    );
  }

  protected eliminar(e: EventoPartido): void {
    this.borrando.set(null);
    this.ejecutar(this.organizador.eliminarEvento(e.idEvento), 'Evento eliminado.');
  }

  private ejecutar(accion: Observable<unknown>, exito: string, alTerminar?: () => void): void {
    this.trabajando.set(true);
    this.mensaje.set(null);
    accion.subscribe({
      next: () => {
        this.mensaje.set({ tipo: 'ok', texto: exito });
        this.trabajando.set(false);
        alTerminar?.();
        this.cargar();
        this.cambio.emit();
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.trabajando.set(false);
      },
    });
  }
}
