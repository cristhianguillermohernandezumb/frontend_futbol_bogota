import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { mensajeDeError } from '../../core/api-error';
import { calcularClasificados, calcularTablasDeGrupos } from '../../core/clasificacion';
import { RONDA_32AVOS, faseDeGruposTerminada } from '../../core/eliminatorias';
import { AuthService } from '../../core/auth.service';
import { EspectadorService } from '../../core/espectador.service';
import {
  Cruce,
  EquipoInscrito,
  EstadoPartido,
  EventoPartido,
  TipoEvento,
  EstadoTorneo,
  Goleador,
  GrupoConEquipos,
  Modalidad,
  PartidoConEquipos,
  Penales,
  Posicion,
  Torneo,
} from '../../core/models';
import { TorneoService } from '../../core/torneo.service';
import { CuadroEliminatoria } from '../../shared/cuadro-eliminatoria/cuadro-eliminatoria';
import { TandaPenales } from '../../shared/tanda-penales/tanda-penales';
import { EscudoEquipo } from '../../shared/escudo-equipo/escudo-equipo';

type Pestana = 'posiciones' | 'grupos' | 'cruces' | 'partidos' | 'equipos' | 'goleadores' | 'goleadores-elim';

/** Estado de carga de una seccion: cada una se pide por aparte para que un fallo no tumbe a las demas. */
interface Seccion<T> {
  cargando: boolean;
  error: string | null;
  datos: T;
}

const NUMERAL: Record<Modalidad, string> = {
  FUTBOL_5: '5v5',
  FUTBOL_7: '7v7',
  FUTBOL_8: '8v8',
  FUTBOL_11: '11v11',
};

const ETIQUETA_TORNEO: Record<EstadoTorneo, string> = {
  INSCRIPCION: 'Inscripciones abiertas',
  EN_CURSO: 'En juego',
  FINALIZADO: 'Finalizado',
};

const ETIQUETA_PARTIDO: Record<EstadoPartido, string> = {
  PROGRAMADO: 'Programado',
  EN_JUEGO: 'En juego',
  FINALIZADO: 'Finalizado',
  APLAZADO: 'Aplazado',
};

function inicial<T>(datos: T): Seccion<T> {
  return { cargando: true, error: null, datos };
}

@Component({
  selector: 'app-torneo-detalle',
  imports: [RouterLink, DatePipe, CurrencyPipe, NgTemplateOutlet, EscudoEquipo, CuadroEliminatoria, TandaPenales],
  templateUrl: './torneo-detalle.html',
  styleUrl: './torneo-detalle.css',
})
export class TorneoDetalle implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly espectador = inject(EspectadorService);
  protected readonly auth = inject(AuthService);

  /** La pestana de 32avos solo aparece cuando terminan todos los partidos de la fase de grupos. */
  protected readonly pestanas = computed<{ id: Pestana; texto: string }[]>(() => {
    const base: { id: Pestana; texto: string }[] = [
      { id: 'posiciones', texto: 'Posiciones' },
      { id: 'grupos', texto: 'Grupos' },
    ];
    if (this.gruposTerminados()) {
      base.push({ id: 'cruces', texto: RONDA_32AVOS.titulo });
    }
    const final: { id: Pestana; texto: string }[] = [
      { id: 'partidos', texto: 'Partidos' },
      { id: 'equipos', texto: 'Equipos' },
      { id: 'goleadores', texto: 'Goleadores fase de grupos' },
    ];
    if (this.gruposTerminados()) {
      final.push({ id: 'goleadores-elim', texto: 'Goleadores tras fase de grupos' });
    }
    return [...base, ...final];
  });

  protected readonly pestana = signal<Pestana>('posiciones');
  protected readonly torneo = signal<Seccion<Torneo | null>>(inicial(null));
  protected readonly posiciones = signal<Seccion<Posicion[]>>(inicial([]));
  protected readonly grupos = signal<Seccion<GrupoConEquipos[]>>(inicial([]));
  protected readonly cruces = signal<Seccion<Cruce[]>>(inicial([]));
  protected readonly penales = signal<Penales[]>([]);
  protected readonly partidos = signal<Seccion<PartidoConEquipos[]>>(inicial([]));
  protected readonly equipos = signal<Seccion<EquipoInscrito[]>>(inicial([]));
  protected readonly goleadores = signal<Seccion<Goleador[]>>(inicial([]));
  protected readonly goleadoresElim = signal<Seccion<Goleador[]>>(inicial([]));
  /** Partido con la tanda de penales desplegada. */
  protected readonly conPenales = signal<number | null>(null);

  /** Cada grupo con su tabla y los clasificados a la siguiente ronda (ver core/clasificacion.ts). */
  protected readonly tablasDeGrupos = computed(() => calcularTablasDeGrupos(this.grupos().datos, this.posiciones().datos));
  protected readonly clasificados = computed(() => calcularClasificados(this.tablasDeGrupos()));

  protected readonly gruposTerminados = computed(() => faseDeGruposTerminada(this.partidos().datos));

  /** Partidos agrupados por jornada, en orden de fecha. */
  protected readonly jornadas = computed(() => {
    const porJornada = new Map<number, PartidoConEquipos[]>();
    const ordenados = [...this.partidos().datos].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    for (const p of ordenados) {
      porJornada.set(p.jornada, [...(porJornada.get(p.jornada) ?? []), p]);
    }
    return [...porJornada.entries()]
      .sort(([a], [b]) => a - b)
      .map(([jornada, lista]) => ({ jornada, partidos: lista }));
  });

  /** null mientras se consulta (o si no hay sesion). */
  protected readonly siguiendo = signal<boolean | null>(null);
  protected readonly trabajandoSeguir = signal(false);
  protected readonly errorSeguir = signal<string | null>(null);

  /** Partido con el panel de eventos abierto y los eventos ya pedidos de cada partido. */
  protected readonly abierto = signal<number | null>(null);
  protected readonly eventosDe = signal<Record<number, Seccion<EventoPartido[]>>>({});

  private id = 0;

  ngOnInit(): void {
    // Permite volver directamente a una pestana (por ejemplo desde la pagina de un equipo): /torneos/1?pestana=equipos
    const pedida = this.ruta.snapshot.queryParamMap.get('pestana');
    if (pedida && ['posiciones', 'grupos', 'cruces', 'partidos', 'equipos', 'goleadores', 'goleadores-elim'].includes(pedida)) {
      this.pestana.set(pedida as Pestana);
    }
    this.ruta.paramMap.subscribe((params) => {
      this.id = Number(params.get('id'));
      this.cargarTodo();
    });
  }

  protected cargarTodo(): void {
    if (!Number.isInteger(this.id) || this.id <= 0) {
      this.torneo.set({ cargando: false, error: 'El torneo que buscas no existe.', datos: null });
      return;
    }
    this.cargarTorneo();
    this.cargarSeguimiento();
    this.cargarPosiciones();
    this.cargarGrupos();
    this.cargarCruces();
    this.cargarPenales();
    this.cargarPartidos();
    this.cargarEquipos();
    this.cargarGoleadores();
  }

  protected cargarTorneo(): void {
    const id = this.id;
    this.torneo.set(inicial(null));
    this.torneoService.obtener(id).subscribe({
      next: (datos) => id === this.id && this.torneo.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.torneo.set({ cargando: false, error: mensajeDeError(err), datos: null }),
    });
  }

  protected cargarSeguimiento(): void {
    const id = this.id;
    const usuario = this.auth.usuario();
    this.siguiendo.set(null);
    this.errorSeguir.set(null);
    this.abierto.set(null);
    this.eventosDe.set({});
    if (!usuario) {
      return;
    }
    this.espectador.seguimientos(usuario.idUsuario).subscribe({
      next: (lista) => id === this.id && this.siguiendo.set(lista.some((s) => s.idTorneo === id)),
      // Si falla la consulta, el boton simplemente no aparece: ver el torneo no depende de esto.
      error: () => id === this.id && this.siguiendo.set(null),
    });
  }

  protected alternarSeguir(): void {
    const usuario = this.auth.usuario();
    const id = this.id;
    const sigue = this.siguiendo();
    if (!usuario || sigue === null) {
      return;
    }
    this.trabajandoSeguir.set(true);
    this.errorSeguir.set(null);
    const accion: Observable<unknown> = sigue ? this.espectador.dejarDeSeguir(usuario.idUsuario, id) : this.espectador.seguir(usuario.idUsuario, id);
    accion.subscribe({
      next: () => {
        this.siguiendo.set(!sigue);
        this.trabajandoSeguir.set(false);
      },
      error: (err: unknown) => {
        this.errorSeguir.set(mensajeDeError(err));
        this.trabajandoSeguir.set(false);
      },
    });
  }

  protected alternarEventos(p: PartidoConEquipos): void {
    if (this.abierto() === p.idPartido) {
      this.abierto.set(null);
      return;
    }
    this.abierto.set(p.idPartido);
    if (!this.eventosDe()[p.idPartido] || this.eventosDe()[p.idPartido].error) {
      this.pedirEventos(p.idPartido);
    }
  }

  protected pedirEventos(idPartido: number): void {
    this.eventosDe.update((m) => ({ ...m, [idPartido]: inicial<EventoPartido[]>([]) }));
    this.espectador.eventos(idPartido).subscribe({
      next: (datos) =>
        this.eventosDe.update((m) => ({
          ...m,
          [idPartido]: { cargando: false, error: null, datos: [...datos].sort((a, b) => a.minuto - b.minuto || a.idEvento - b.idEvento) },
        })),
      error: (err: unknown) =>
        this.eventosDe.update((m) => ({ ...m, [idPartido]: { cargando: false, error: mensajeDeError(err), datos: [] } })),
    });
  }

  protected nombreEquipoEvento(p: PartidoConEquipos, e: EventoPartido): string {
    return e.idEquipo === p.idLocal ? (p.local ?? '') : e.idEquipo === p.idVisitante ? (p.visitante ?? '') : '';
  }

  protected etiquetaEvento(t: TipoEvento): string {
    return { GOL: 'Gol', AUTOGOL: 'Autogol', AMARILLA: 'Tarjeta amarilla', ROJA: 'Tarjeta roja', FALTA: 'Falta' }[t];
  }

  protected claseEvento(t: TipoEvento): string {
    return `ev-icono ev-${t.toLowerCase()}`;
  }

  protected cargarPosiciones(): void {
    const id = this.id;
    this.posiciones.set(inicial([]));
    this.torneoService.posiciones(id).subscribe({
      next: (datos) => id === this.id && this.posiciones.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.posiciones.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
  }

  protected cargarGrupos(): void {
    const id = this.id;
    this.grupos.set(inicial([]));
    this.torneoService.grupos(id).subscribe({
      next: (datos) => id === this.id && this.grupos.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.grupos.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
  }

  protected cargarPenales(): void {
    const id = this.id;
    // Es un dato extra (marcador de penales): si falla, el resto del torneo se ve igual.
    this.torneoService.penalesDeTorneo(id).subscribe({
      next: (datos) => id === this.id && this.penales.set(datos),
      error: () => id === this.id && this.penales.set([]),
    });
  }

  protected penalDe(idPartido: number): Penales | undefined {
    return this.penales().find((x) => x.idPartido === idPartido && x.tiros.length > 0);
  }

  protected cargarCruces(): void {
    const id = this.id;
    this.cruces.set(inicial([]));
    this.torneoService.cruces(id, RONDA_32AVOS.codigo).subscribe({
      next: (datos) => id === this.id && this.cruces.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.cruces.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
  }

  protected cargarPartidos(): void {
    const id = this.id;
    this.partidos.set(inicial([]));
    this.torneoService.partidos(id).subscribe({
      next: (datos) => id === this.id && this.partidos.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.partidos.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
  }

  protected cargarEquipos(): void {
    const id = this.id;
    this.equipos.set(inicial([]));
    this.torneoService.equipos(id).subscribe({
      next: (datos) => id === this.id && this.equipos.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.equipos.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
  }

  protected cargarGoleadores(): void {
    const id = this.id;
    this.goleadores.set(inicial([]));
    this.goleadoresElim.set(inicial([]));
    this.torneoService.goleadores(id, 10, 'grupos').subscribe({
      next: (datos) => id === this.id && this.goleadores.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.goleadores.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
    this.torneoService.goleadores(id, 10, 'eliminatoria').subscribe({
      next: (datos) => id === this.id && this.goleadoresElim.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.goleadoresElim.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
  }

  protected alternarPenales(idPartido: number): void {
    this.conPenales.set(this.conPenales() === idPartido ? null : idPartido);
  }

  protected elegir(p: Pestana): void {
    this.pestana.set(p);
  }

  protected numeral(m: Modalidad): string {
    return NUMERAL[m];
  }

  protected etiquetaTorneo(e: EstadoTorneo): string {
    return ETIQUETA_TORNEO[e];
  }

  protected claseEstado(e: string): string {
    return `estado estado-${e.toLowerCase()}`;
  }

  protected etiquetaPartido(e: EstadoPartido): string {
    return ETIQUETA_PARTIDO[e];
  }

  /** Solo se muestra marcador cuando el partido ya empezo; si no, "vs". */
  protected conMarcador(p: PartidoConEquipos): boolean {
    return p.estado === 'EN_JUEGO' || p.estado === 'FINALIZADO';
  }

  protected etiquetaInscripcion(estado: string): string {
    return estado === 'PAGADA' ? 'Pagada' : 'Pendiente de pago';
  }
}
