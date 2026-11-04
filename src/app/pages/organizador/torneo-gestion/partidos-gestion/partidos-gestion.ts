import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import {
  Cancha,
  EquipoInscrito,
  EstadoPartido,
  GrupoConEquipos,
  PartidoConEquipos,
  TipoSuperficie,
  Torneo,
} from '../../../../core/models';
import { clavePareja, todosContraTodos } from '../../../../core/calendario';
import { esFase } from '../../../../core/eliminatorias';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';
import { EscudoEquipo } from '../../../../shared/escudo-equipo/escudo-equipo';
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

/** Partido de la fase de grupos por programar: ya se sabe quien juega y en que jornada; falta fecha y cancha. */
interface Pendiente {
  clave: string;
  letra: string;
  jornada: number;
  a: { id: number; nombre: string };
  b: { id: number; nombre: string };
}

interface Borrador {
  fecha: string;
  idCancha: number;
  /** true si el organizador cambio quien es local. */
  invertido: boolean;
}

const BORRADOR_VACIO: Borrador = { fecha: '', idCancha: 0, invertido: false };

const ETIQUETA_ESTADO: Record<EstadoPartido, string> = {
  PROGRAMADO: 'Programado',
  EN_JUEGO: 'En juego',
  FINALIZADO: 'Finalizado',
  APLAZADO: 'Aplazado',
};

@Component({
  selector: 'app-partidos-gestion',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, ArbitrosPartido, EscudoEquipo],
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

  protected readonly grupos = signal<GrupoConEquipos[]>([]);
  protected readonly borradores = signal<Record<string, Borrador>>({});

  /**
   * Partidos de la fase de grupos que faltan por programar: todos contra todos dentro de cada grupo. La fase
   * ("Grupos") y la jornada salen del calendario; el organizador solo pone fecha, cancha y, si quiere, cambia el local.
   */
  protected readonly pendientes = computed<Pendiente[]>(() => {
    const hechos = new Set(
      this.partidos()
        .filter((p) => esFase(p, 'Grupos') && p.idLocal && p.idVisitante)
        .map((p) => clavePareja(p.idLocal as number, p.idVisitante as number)),
    );
    const lista: Pendiente[] = [];
    for (const g of this.grupos()) {
      const nombres = new Map(g.equipos.map((e) => [e.idEquipo, e.nombreEquipo]));
      for (const m of todosContraTodos(g.equipos.map((e) => e.idEquipo))) {
        const clave = clavePareja(m.local, m.visitante);
        if (!hechos.has(clave)) {
          lista.push({
            clave,
            letra: g.letra,
            jornada: m.jornada,
            a: { id: m.local, nombre: nombres.get(m.local) ?? '' },
            b: { id: m.visitante, nombre: nombres.get(m.visitante) ?? '' },
          });
        }
      }
    }
    return lista.sort((x, y) => x.jornada - y.jornada || x.letra.localeCompare(y.letra));
  });
  /** Los pendientes agrupados por jornada, para mostrarlos con un titulo por jornada. */
  protected readonly pendientesPorJornada = computed(() => {
    const mapa = new Map<number, Pendiente[]>();
    for (const f of this.pendientes()) {
      mapa.set(f.jornada, [...(mapa.get(f.jornada) ?? []), f]);
    }
    return [...mapa.entries()].map(([jornada, items]) => ({ jornada, items }));
  });
  protected readonly listos = computed(() => this.pendientes().filter((f) => this.completo(f)));

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
    let faltan = 4;
    const listo = () => {
      if (--faltan === 0) {
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
    this.torneoService.grupos(id).subscribe({
      next: (l) => {
        this.grupos.set(l);
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

  // ---- fase de grupos: partidos por programar ----

  protected borrador(f: Pendiente): Borrador {
    return this.borradores()[f.clave] ?? BORRADOR_VACIO;
  }

  protected completo(f: Pendiente): boolean {
    const b = this.borrador(f);
    return !!b.fecha && b.idCancha > 0;
  }

  protected local(f: Pendiente): { id: number; nombre: string } {
    return this.borrador(f).invertido ? f.b : f.a;
  }

  protected visitante(f: Pendiente): { id: number; nombre: string } {
    return this.borrador(f).invertido ? f.a : f.b;
  }

  protected cambiar(f: Pendiente, cambio: Partial<Borrador>): void {
    this.borradores.update((m) => ({ ...m, [f.clave]: { ...this.borrador(f), ...cambio } }));
  }

  protected intercambiar(f: Pendiente): void {
    this.cambiar(f, { invertido: !this.borrador(f).invertido });
  }

  private crearPendiente(f: Pendiente): Observable<unknown> {
    const b = this.borrador(f);
    return this.organizador.programarPartido(
      {
        fechaHora: b.fecha,
        estado: 'PROGRAMADO',
        fase: 'Grupos',
        jornada: f.jornada,
        idCancha: b.idCancha,
        idTorneo: this.torneo().idTorneo,
      },
      this.local(f).id,
      this.visitante(f).id,
    );
  }

  protected programarPendiente(f: Pendiente): void {
    if (!this.completo(f) || this.trabajando()) {
      return;
    }
    this.ejecutar(
      this.crearPendiente(f),
      `Partido programado: ${this.local(f).nombre} vs ${this.visitante(f).nombre}.`,
    );
  }

  /** Programa uno tras otro todos los partidos que ya tienen fecha y cancha; los que fallan quedan en la lista. */
  protected programarListos(): void {
    const lista = this.listos();
    if (lista.length === 0 || this.trabajando()) {
      return;
    }
    this.trabajando.set(true);
    this.mensaje.set(null);
    let hechos = 0;
    const errores: string[] = [];
    from(lista)
      .pipe(
        concatMap((f) =>
          this.crearPendiente(f).pipe(
            map(() => void hechos++),
            catchError((err: unknown) => {
              errores.push(`${this.local(f).nombre} vs ${this.visitante(f).nombre}: ${mensajeDeError(err)}`);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe({
        complete: () => {
          this.trabajando.set(false);
          this.mensaje.set(
            errores.length === 0
              ? { tipo: 'ok', texto: `${hechos} partidos programados.` }
              : {
                  tipo: 'error',
                  texto: `${hechos} programados, ${errores.length} con error. ${errores.slice(0, 3).join(' · ')}`,
                },
          );
          this.cargar();
        },
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
