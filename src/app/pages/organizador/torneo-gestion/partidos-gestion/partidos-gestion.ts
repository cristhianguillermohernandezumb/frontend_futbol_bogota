import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import {
  Cancha,
  EquipoInscrito,
  EstadoPartido,
  PartidoConEquipos,
  TipoSuperficie,
  Torneo,
} from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';
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

@Component({
  selector: 'app-partidos-gestion',
  imports: [ReactiveFormsModule, DatePipe, ArbitrosPartido],
  templateUrl: './partidos-gestion.html',
  styleUrl: './partidos-gestion.css',
})
export class PartidosGestion implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly partidos = signal<PartidoConEquipos[]>([]);
  protected readonly canchas = signal<Cancha[]>([]);
  protected readonly inscritos = signal<EquipoInscrito[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly eliminando = signal<number | null>(null);
  /** Partido cuyo panel de arbitros esta abierto. */
  protected readonly conArbitros = signal<number | null>(null);

  protected readonly puedeProgramar = computed(() => this.torneo().estado !== 'FINALIZADO');
  protected readonly ordenados = computed(() =>
    [...this.partidos()].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
  );

  protected readonly superficies: { valor: TipoSuperficie; texto: string }[] = [
    { valor: 'SINTETICA', texto: 'Sintética' },
    { valor: 'NATURAL', texto: 'Natural' },
    { valor: 'CEMENTO', texto: 'Cemento' },
  ];

  protected readonly mostrarForm = signal(false);
  protected readonly mostrarCancha = signal(false);
  protected readonly intento = signal(false);
  protected readonly intentoCancha = signal(false);

  protected readonly form = this.fb.group({
    fechaHora: ['', [Validators.required]],
    fase: ['Grupos', [Validators.required, Validators.maxLength(50)]],
    jornada: [1, [Validators.required, Validators.min(1)]],
    idCancha: [0, [Validators.min(1)]],
    idLocal: [0, [Validators.min(1)]],
    idVisitante: [0, [Validators.min(1)]],
  });

  protected readonly formCancha = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    direccion: ['', [Validators.required, Validators.maxLength(50)]],
    tipoSuperficie: ['SINTETICA' as TipoSuperficie, [Validators.required]],
    localidad: ['', [Validators.required, Validators.maxLength(50)]],
    capacidad: [100, [Validators.required, Validators.min(1)]],
    largo: [40, [Validators.required, Validators.min(1)]],
    ancho: [20, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const id = this.torneo().idTorneo;
    this.cargando.set(true);
    this.errorCarga.set(null);
    let pendientes = 3;
    const listo = () => {
      if (--pendientes === 0) {
        this.cargando.set(false);
      }
    };
    const falla = (err: unknown) => {
      this.errorCarga.set(mensajeDeError(err));
      listo();
    };
    this.torneoService.partidos(id).subscribe({
      next: (l) => {
        this.partidos.set(l);
        listo();
      },
      error: falla,
    });
    this.organizador.canchas().subscribe({
      next: (l) => {
        this.canchas.set(l);
        listo();
      },
      error: falla,
    });
    this.torneoService.equipos(id).subscribe({
      next: (l) => {
        this.inscritos.set(l);
        listo();
      },
      error: falla,
    });
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected invalidoCancha(campo: keyof typeof this.formCancha.controls): boolean {
    return this.intentoCancha() && this.formCancha.controls[campo].invalid;
  }

  /** Limites del selector de fecha: el partido debe caer dentro de las fechas del torneo. */
  protected minFecha(): string {
    return this.torneo().fechaInicio + 'T00:00';
  }

  protected maxFecha(): string {
    return this.torneo().fechaFin + 'T23:59';
  }

  protected programar(): void {
    this.intento.set(true);
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      return;
    }
    if (Number(v.idLocal) === Number(v.idVisitante)) {
      this.mensaje.set({ tipo: 'error', texto: 'El equipo local y el visitante deben ser distintos.' });
      return;
    }
    this.ejecutar(
      this.organizador.programarPartido(
        {
          fechaHora: v.fechaHora,
          estado: 'PROGRAMADO',
          fase: v.fase.trim(),
          jornada: Number(v.jornada),
          idCancha: Number(v.idCancha),
          idTorneo: this.torneo().idTorneo,
        },
        Number(v.idLocal),
        Number(v.idVisitante),
      ),
      'Partido programado.',
      () => {
        this.form.patchValue({ fechaHora: '', idLocal: 0, idVisitante: 0 });
        this.intento.set(false);
        this.mostrarForm.set(false);
      },
    );
  }

  protected crearCancha(): void {
    this.intentoCancha.set(true);
    if (this.formCancha.invalid) {
      return;
    }
    const v = this.formCancha.getRawValue();
    this.ejecutar(
      this.organizador.crearCancha({
        nombre: v.nombre.trim(),
        direccion: v.direccion.trim(),
        tipoSuperficie: v.tipoSuperficie,
        localidad: v.localidad.trim(),
        capacidad: Number(v.capacidad),
        largo: Number(v.largo),
        ancho: Number(v.ancho),
      }),
      'Cancha creada.',
      () => {
        this.formCancha.reset({ tipoSuperficie: 'SINTETICA', capacidad: 100, largo: 40, ancho: 20 });
        this.intentoCancha.set(false);
        this.mostrarCancha.set(false);
      },
    );
  }

  protected cambiarEstado(p: PartidoConEquipos, t: Transicion): void {
    this.ejecutar(
      this.organizador.cambiarEstadoPartido(p.idPartido, t.valor),
      `Partido ${ETIQUETA_ESTADO[t.valor].toLowerCase()}.`,
    );
  }

  protected eliminar(p: PartidoConEquipos): void {
    this.eliminando.set(null);
    this.ejecutar(this.organizador.eliminarPartido(p.idPartido), 'Partido eliminado.');
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
