import { Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { mensajeDeError } from '../../core/api-error';
import { Penales } from '../../core/models';
import { OrganizadorService } from '../../core/organizador.service';
import { TorneoService } from '../../core/torneo.service';
import { EscudoEquipo } from '../escudo-equipo/escudo-equipo';

interface EquipoTanda {
  idEquipo: number;
  nombre: string;
}

type EstadoTiro = 'gol' | 'fallo' | 'turno' | 'pendiente';

interface Fila {
  rol: 'LOCAL' | 'VISITANTE';
  equipo: EquipoTanda;
  goles: number;
  tiros: EstadoTiro[];
  puedePatear: boolean;
  gana: boolean;
}

/**
 * Tanda de penales de un partido de eliminatoria empatado. Los tiros se alternan empezando por el local;
 * el organizador solo marca "Gol" o "No gol" para el equipo que patea y el resultado sale solo
 * (las reglas, incluida la muerte subita, las aplica el backend).
 */
@Component({
  selector: 'app-tanda-penales',
  imports: [EscudoEquipo],
  templateUrl: './tanda-penales.html',
  styleUrl: './tanda-penales.css',
})
export class TandaPenales {
  readonly idPartido = input.required<number>();
  readonly local = input.required<EquipoTanda>();
  readonly visitante = input.required<EquipoTanda>();
  /** true cuando quien mira es el organizador y el partido sigue EN_JUEGO. */
  readonly editable = input(false);
  readonly version = input(0);
  readonly cambio = output<Penales>();

  private readonly torneoService = inject(TorneoService);
  private readonly organizador = inject(OrganizadorService);

  protected readonly datos = signal<Penales | null>(null);
  protected readonly Math = Math;
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly trabajando = signal(false);

  constructor() {
    // Si cambia el partido (o el padre pide refrescar), se vuelve a leer la tanda.
    effect(() => {
      this.idPartido();
      this.version();
      this.cargar();
    });
  }

  /** Casillas por equipo: 5 y, en muerte subita, una mas cada ronda (mostrando la que se va a patear). */
  protected readonly casillas = computed(() => {
    const d = this.datos();
    if (!d) {
      return 5;
    }
    const tl = d.tiros.filter((t) => t.rol === 'LOCAL').length;
    const tv = d.tiros.filter((t) => t.rol === 'VISITANTE').length;
    const pendienteExtra = !d.ganador && tl === tv && tl >= 5 ? 1 : 0;
    return Math.max(5, Math.max(tl, tv) + pendienteExtra);
  });

  protected readonly filas = computed<Fila[]>(() => {
    const d = this.datos();
    if (!d) {
      return [];
    }
    const armar = (rol: 'LOCAL' | 'VISITANTE', equipo: EquipoTanda, goles: number): Fila => {
      const hechos = d.tiros.filter((t) => t.rol === rol);
      const tiros: EstadoTiro[] = [];
      for (let i = 0; i < this.casillas(); i++) {
        const t = hechos[i];
        tiros.push(t ? (t.convertido ? 'gol' : 'fallo') : !d.ganador && d.siguiente === rol && i === hechos.length ? 'turno' : 'pendiente');
      }
      return {
        rol,
        equipo,
        goles,
        tiros,
        puedePatear: this.editable() && !d.ganador && d.siguiente === rol && !this.trabajando(),
        gana: d.ganador === rol,
      };
    };
    return [armar('LOCAL', this.local(), d.golesLocal), armar('VISITANTE', this.visitante(), d.golesVisitante)];
  });

  protected readonly enMuerteSubita = computed(() => this.casillas() > 5 || (this.datos()?.tiros.length ?? 0) >= 10);

  protected readonly nombreGanador = computed(() => {
    const d = this.datos();
    return d?.ganador === 'LOCAL' ? this.local().nombre : d?.ganador === 'VISITANTE' ? this.visitante().nombre : null;
  });

  protected etiqueta(e: EstadoTiro): string {
    return { gol: 'Gol', fallo: 'Fallo', turno: 'Le toca patear', pendiente: 'Pendiente' }[e];
  }

  protected cargar(): void {
    const id = this.idPartido();
    this.cargando.set(true);
    this.error.set(null);
    this.torneoService.penales(id).subscribe({
      next: (d) => {
        if (id === this.idPartido()) {
          this.datos.set(d);
          this.cargando.set(false);
        }
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected patear(convertido: boolean): void {
    this.ejecutar(this.organizador.registrarPenal(this.idPartido(), convertido));
  }

  protected deshacer(): void {
    this.ejecutar(this.organizador.deshacerPenal(this.idPartido()));
  }

  private ejecutar(accion: ReturnType<OrganizadorService['registrarPenal']>): void {
    this.trabajando.set(true);
    this.error.set(null);
    accion.subscribe({
      next: (d) => {
        this.datos.set(d);
        this.trabajando.set(false);
        this.cambio.emit(d);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.trabajando.set(false);
      },
    });
  }
}
