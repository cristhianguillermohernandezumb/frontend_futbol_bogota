import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { RONDAS_ELIMINATORIA, calcularRondas } from '../../../../core/eliminatorias';
import { RONDA_32AVOS } from '../../../../core/eliminatorias';
import { Cancha, Cruce, EstadoPartido, PartidoConEquipos, Penales, Torneo } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';
import { EscudoEquipo } from '../../../../shared/escudo-equipo/escudo-equipo';
import { TandaPenales } from '../../../../shared/tanda-penales/tanda-penales';
import { ArbitrosPartido } from '../arbitros-partido/arbitros-partido';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

interface Transicion {
  valor: EstadoPartido;
  texto: string;
}

/** Cambios de estado permitidos por el backend para cada estado de partido. */
const TRANSICIONES: Record<EstadoPartido, Transicion[]> = {
  PROGRAMADO: [
    { valor: 'EN_JUEGO', texto: 'Iniciar' },
    { valor: 'APLAZADO', texto: 'Aplazar' },
  ],
  APLAZADO: [{ valor: 'PROGRAMADO', texto: 'Reprogramar' }],
  EN_JUEGO: [{ valor: 'FINALIZADO', texto: 'Finalizar' }],
  FINALIZADO: [],
};

const ETIQUETA_ESTADO: Record<EstadoPartido, string> = {
  PROGRAMADO: 'Programado',
  EN_JUEGO: 'En juego',
  FINALIZADO: 'Finalizado',
  APLAZADO: 'Aplazado',
};

/** Una fila del cuadro con la forma que usa la plantilla (un cruce con su partido y su ganador). */
interface Fila {
  ronda: number;
  cruce: { idCruce: number; orden: number; idLocal: number; nombreLocal: string; idVisitante: number; nombreVisitante: string };
  partido: PartidoConEquipos | undefined;
  listo: boolean;
  pasa: string | null;
}

interface GrupoRonda {
  titulo: string;
  filas: Fila[];
}

/**
 * Partidos de la eliminatoria: los equipos de 32avos vienen de los cruces y los de las rondas siguientes salen solos de
 * los ganadores (por goles o por penales); aqui solo se agrega fecha, cancha, arbitros, alineacion y eventos.
 */
@Component({
  selector: 'app-partidos-eliminatoria',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, ArbitrosPartido, EscudoEquipo, TandaPenales],
  templateUrl: './partidos-eliminatoria.html',
  styleUrl: './partidos-eliminatoria.css',
})
export class PartidosEliminatoria implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly titulo = RONDA_32AVOS.titulo;
  protected readonly tituloGeneral = 'la eliminatoria';

  protected readonly cruces = signal<Cruce[]>([]);
  protected readonly partidos = signal<PartidoConEquipos[]>([]);
  protected readonly canchas = signal<Cancha[]>([]);
  protected readonly penales = signal<Penales[]>([]);
  /** Partido con la tanda de penales abierta. */
  protected readonly conPenales = signal<number | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);

  /** Cruce con el formulario de partido abierto, partido con arbitros abiertos y partido pendiente de eliminar. */
  protected readonly creandoPara = signal<number | null>(null);
  protected readonly conArbitros = signal<number | null>(null);
  protected readonly eliminando = signal<number | null>(null);
  protected readonly intento = signal(false);

  protected readonly puedeProgramar = computed(() => this.torneo().estado !== 'FINALIZADO');

  /** Todas las rondas, con los equipos que ya se conocen. */
  protected readonly grupos = computed<GrupoRonda[]>(() => {
    if (this.cruces().length === 0) {
      return [];
    }
    return calcularRondas(this.cruces(), this.partidos(), this.penales()).map((cruces, r) => ({
      titulo: RONDAS_ELIMINATORIA[r].titulo,
      filas: cruces.map((c): Fila => ({
        ronda: r,
        cruce: {
          idCruce: r * 100 + c.orden,
          orden: c.orden,
          idLocal: c.local?.idEquipo ?? 0,
          nombreLocal: c.local?.nombre ?? 'Por definir',
          idVisitante: c.visitante?.idEquipo ?? 0,
          nombreVisitante: c.visitante?.nombre ?? 'Por definir',
        },
        partido: c.partido,
        listo: !!c.local && !!c.visitante,
        pasa: c.ganador?.nombre ?? null,
      })),
    }));
  });
  protected readonly filas = computed(() => this.grupos().flatMap((g) => g.filas).filter((f) => f.listo));
  protected readonly creados = computed(() => this.filas().filter((f) => !!f.partido).length);

  protected readonly form = this.fb.group({
    fechaHora: ['', [Validators.required]],
    idCancha: [0, [Validators.min(1)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const id = this.torneo().idTorneo;
    this.cargando.set(true);
    this.errorCarga.set(null);
    forkJoin({
      cruces: this.torneoService.cruces(id, RONDA_32AVOS.codigo),
      partidos: this.torneoService.partidos(id),
      canchas: this.organizador.canchas(),
      penales: this.torneoService.penalesDeTorneo(id),
    }).subscribe({
      next: (r) => {
        this.cruces.set(r.cruces);
        this.partidos.set(r.partidos);
        this.canchas.set(r.canchas);
        this.penales.set(r.penales);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected minFecha(): string {
    return this.torneo().fechaInicio + 'T00:00';
  }

  protected maxFecha(): string {
    return this.torneo().fechaFin + 'T23:59';
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected abrirFormulario(idCruce: number): void {
    this.mensaje.set(null);
    this.intento.set(false);
    this.creandoPara.set(this.creandoPara() === idCruce ? null : idCruce);
  }

  protected crearPartido(f: Fila): void {
    const c = f.cruce;
    const ronda = RONDAS_ELIMINATORIA[f.ronda];
    this.intento.set(true);
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    this.ejecutar(
      this.organizador.programarPartido(
        {
          fechaHora: v.fechaHora,
          estado: 'PROGRAMADO',
          fase: ronda.fase,
          jornada: ronda.jornada,
          idCancha: Number(v.idCancha),
          idTorneo: this.torneo().idTorneo,
        },
        c.idLocal,
        c.idVisitante,
      ),
      `Partido de ${ronda.titulo.toLowerCase()} (${c.nombreLocal} vs ${c.nombreVisitante}) creado.`,
      () => {
        this.form.patchValue({ fechaHora: '' });
        this.intento.set(false);
        this.creandoPara.set(null);
      },
    );
  }

  protected cambiarEstado(p: PartidoConEquipos, t: Transicion): void {
    this.ejecutar(this.organizador.cambiarEstadoPartido(p.idPartido, t.valor), `Partido ${ETIQUETA_ESTADO[t.valor].toLowerCase()}.`);
  }

  protected eliminar(p: PartidoConEquipos): void {
    this.eliminando.set(null);
    this.ejecutar(this.organizador.eliminarPartido(p.idPartido), 'Partido eliminado.');
  }

  protected penalDe(idPartido: number): Penales | undefined {
    return this.penales().find((x) => x.idPartido === idPartido && x.tiros.length > 0);
  }

  /** Partido de eliminatoria empatado que ya empezo (o ya tiene tanda): se define con penales. */
  protected empatado(p: PartidoConEquipos): boolean {
    return (p.estado === 'EN_JUEGO' || p.estado === 'FINALIZADO') && p.golesLocal === p.golesVisitante;
  }

  protected tandaPendiente(p: PartidoConEquipos): boolean {
    return p.estado === 'EN_JUEGO' && this.empatado(p) && !this.penalDe(p.idPartido)?.ganador;
  }

  protected alternarPenales(id: number): void {
    this.mensaje.set(null);
    this.conPenales.set(this.conPenales() === id ? null : id);
  }

  protected recargarPenales(): void {
    this.torneoService.penalesDeTorneo(this.torneo().idTorneo).subscribe({ next: (l) => this.penales.set(l) });
  }

  protected alternarArbitros(id: number): void {
    this.mensaje.set(null);
    this.conArbitros.set(this.conArbitros() === id ? null : id);
  }

  protected transiciones(p: PartidoConEquipos): Transicion[] {
    return TRANSICIONES[p.estado];
  }

  protected etiquetaEstado(e: EstadoPartido): string {
    return ETIQUETA_ESTADO[e];
  }

  protected conMarcador(p: PartidoConEquipos): boolean {
    return p.estado === 'EN_JUEGO' || p.estado === 'FINALIZADO';
  }

  protected puedeEliminar(p: PartidoConEquipos): boolean {
    return p.estado === 'PROGRAMADO' || p.estado === 'APLAZADO';
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
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.trabajando.set(false);
        // Si el partido se creo pero fallo la asignacion de equipos, la lista debe reflejarlo.
        this.cargar();
      },
    });
  }
}
