import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { RONDA_32AVOS, partidoDeCruce } from '../../../../core/eliminatorias';
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

/** Partidos de la primera eliminatoria: los equipos ya vienen de los cruces; aqui solo se agrega lo del partido. */
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

  /** Cada cruce con su partido (si ya se creo). */
  protected readonly filas = computed(() =>
    [...this.cruces()]
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ cruce: c, partido: partidoDeCruce(this.partidos(), c) })),
  );
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

  protected crearPartido(c: Cruce): void {
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
          fase: RONDA_32AVOS.fase,
          jornada: RONDA_32AVOS.jornada,
          idCancha: Number(v.idCancha),
          idTorneo: this.torneo().idTorneo,
        },
        c.idLocal,
        c.idVisitante,
      ),
      `Partido del cruce ${c.orden} creado.`,
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
