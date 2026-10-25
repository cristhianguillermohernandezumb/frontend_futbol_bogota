import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/api-error';
import {
  EquipoInscrito,
  EstadoPartido,
  EstadoTorneo,
  Goleador,
  Modalidad,
  PartidoConEquipos,
  Posicion,
  Torneo,
} from '../../core/models';
import { TorneoService } from '../../core/torneo.service';

type Pestana = 'posiciones' | 'partidos' | 'equipos' | 'goleadores';

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
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './torneo-detalle.html',
  styleUrl: './torneo-detalle.css',
})
export class TorneoDetalle implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);

  protected readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'posiciones', texto: 'Posiciones' },
    { id: 'partidos', texto: 'Partidos' },
    { id: 'equipos', texto: 'Equipos' },
    { id: 'goleadores', texto: 'Goleadores' },
  ];

  protected readonly pestana = signal<Pestana>('posiciones');
  protected readonly torneo = signal<Seccion<Torneo | null>>(inicial(null));
  protected readonly posiciones = signal<Seccion<Posicion[]>>(inicial([]));
  protected readonly partidos = signal<Seccion<PartidoConEquipos[]>>(inicial([]));
  protected readonly equipos = signal<Seccion<EquipoInscrito[]>>(inicial([]));
  protected readonly goleadores = signal<Seccion<Goleador[]>>(inicial([]));

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

  private id = 0;

  ngOnInit(): void {
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
    this.cargarPosiciones();
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

  protected cargarPosiciones(): void {
    const id = this.id;
    this.posiciones.set(inicial([]));
    this.torneoService.posiciones(id).subscribe({
      next: (datos) => id === this.id && this.posiciones.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.posiciones.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
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
    this.torneoService.goleadores(id).subscribe({
      next: (datos) => id === this.id && this.goleadores.set({ cargando: false, error: null, datos }),
      error: (err: unknown) =>
        id === this.id && this.goleadores.set({ cargando: false, error: mensajeDeError(err), datos: [] }),
    });
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
