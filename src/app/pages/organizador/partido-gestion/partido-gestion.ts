import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../../core/api-error';
import { AuthService } from '../../../core/auth.service';
import { Alineacion, EquipoDePartido, EstadoPartido, Partido, Torneo } from '../../../core/models';
import { OrganizadorService } from '../../../core/organizador.service';
import { TorneoService } from '../../../core/torneo.service';
import { AlineacionEquipo } from './alineacion-equipo/alineacion-equipo';
import { TandaPenales } from '../../../shared/tanda-penales/tanda-penales';
import { EventosPartido } from './eventos-partido/eventos-partido';

interface Transicion {
  valor: EstadoPartido;
  texto: string;
}

const TRANSICIONES: Record<EstadoPartido, Transicion[]> = {
  PROGRAMADO: [
    { valor: 'EN_JUEGO', texto: 'Iniciar partido' },
    { valor: 'APLAZADO', texto: 'Aplazar' },
  ],
  APLAZADO: [{ valor: 'PROGRAMADO', texto: 'Reprogramar' }],
  EN_JUEGO: [{ valor: 'FINALIZADO', texto: 'Finalizar partido' }],
  FINALIZADO: [],
};

const ETIQUETA_ESTADO: Record<EstadoPartido, string> = {
  PROGRAMADO: 'Programado',
  EN_JUEGO: 'En juego',
  FINALIZADO: 'Finalizado',
  APLAZADO: 'Aplazado',
};

@Component({
  selector: 'app-partido-gestion',
  imports: [RouterLink, DatePipe, AlineacionEquipo, EventosPartido, TandaPenales],
  templateUrl: './partido-gestion.html',
  styleUrl: './partido-gestion.css',
})
export class PartidoGestion implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);
  protected readonly auth = inject(AuthService);

  protected readonly partido = signal<Partido | null>(null);
  protected readonly torneo = signal<Torneo | null>(null);
  protected readonly local = signal<EquipoDePartido | null>(null);
  protected readonly visitante = signal<EquipoDePartido | null>(null);
  protected readonly alineacion = signal<Alineacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly errorEstado = signal<string | null>(null);
  protected readonly cambiando = signal(false);
  protected readonly confirmando = signal<EstadoPartido | null>(null);

  protected readonly esDueno = computed(() => {
    const t = this.torneo();
    const u = this.auth.usuario();
    return !!t && !!u && (u.rol === 'ADMIN' || u.idUsuario === t.idOrganizador);
  });

  protected readonly transiciones = computed(() => {
    const p = this.partido();
    return p ? TRANSICIONES[p.estado] : [];
  });

  protected readonly conMarcador = computed(() => {
    const p = this.partido();
    return !!p && (p.estado === 'EN_JUEGO' || p.estado === 'FINALIZADO');
  });

  /** Partido de eliminatoria que va empatado: se define con penales (y no se puede finalizar sin ganador). */
  protected readonly hayTanda = computed(() => {
    const p = this.partido();
    return (
      !!p &&
      p.fase.trim().toLowerCase() !== 'grupos' &&
      (p.estado === 'EN_JUEGO' || p.estado === 'FINALIZADO') &&
      p.golesLocal === p.golesVisitante
    );
  });

  protected readonly esEliminatoria = computed(() => {
    const p = this.partido();
    return !!p && p.fase.trim().toLowerCase() !== 'grupos';
  });

  protected readonly equipoLocal = computed(() => {
    const e = this.local();
    return e ? { idEquipo: e.idEquipo, nombre: e.nombreEquipo } : null;
  });

  protected readonly equipoVisitante = computed(() => {
    const e = this.visitante();
    return e ? { idEquipo: e.idEquipo, nombre: e.nombreEquipo } : null;
  });

  private id = 0;

  ngOnInit(): void {
    this.ruta.paramMap.subscribe((params) => {
      this.id = Number(params.get('id'));
      this.cargar();
    });
  }

  protected cargar(): void {
    const id = this.id;
    this.cargando.set(true);
    this.error.set(null);
    this.organizador.partido(id).subscribe({
      next: (p) => {
        if (id !== this.id) {
          return;
        }
        this.partido.set(p);
        let pendientes = 3;
        const listo = () => {
          if (--pendientes === 0 && id === this.id) {
            this.cargando.set(false);
          }
        };
        const falla = (err: unknown) => {
          this.error.set(mensajeDeError(err));
          this.cargando.set(false);
        };
        this.torneoService.obtener(p.idTorneo).subscribe({
          next: (t) => {
            this.torneo.set(t);
            listo();
          },
          error: falla,
        });
        this.organizador.equiposDePartido(id).subscribe({
          next: (lista) => {
            this.local.set(lista.find((e) => e.rol === 'LOCAL') ?? null);
            this.visitante.set(lista.find((e) => e.rol === 'VISITANTE') ?? null);
            listo();
          },
          error: falla,
        });
        this.organizador.alineacion(id).subscribe({
          next: (lista) => {
            this.alineacion.set(lista);
            listo();
          },
          error: falla,
        });
      },
      error: (err: unknown) => {
        if (id === this.id) {
          this.error.set(mensajeDeError(err));
          this.cargando.set(false);
        }
      },
    });
  }

  /** Vuelve a pedir solo el partido (estado y marcador), por ejemplo despues de registrar un gol. */
  protected recargarPartido(): void {
    this.organizador.partido(this.id).subscribe({ next: (p) => this.partido.set(p) });
  }

  protected recargarAlineacion(): void {
    this.organizador.alineacion(this.id).subscribe({ next: (l) => this.alineacion.set(l) });
  }

  protected cambiarEstado(t: Transicion): void {
    this.cambiando.set(true);
    this.errorEstado.set(null);
    this.organizador.cambiarEstadoPartido(this.id, t.valor).subscribe({
      next: (p) => {
        this.partido.set(p);
        this.confirmando.set(null);
        this.cambiando.set(false);
      },
      error: (err: unknown) => {
        this.errorEstado.set(mensajeDeError(err));
        this.confirmando.set(null);
        this.cambiando.set(false);
      },
    });
  }

  /** Iniciar y finalizar piden confirmacion; aplazar y reprogramar se hacen directo. */
  protected pedir(t: Transicion): void {
    if (t.valor === 'EN_JUEGO' || t.valor === 'FINALIZADO') {
      this.errorEstado.set(null);
      this.confirmando.set(t.valor);
    } else {
      this.cambiarEstado(t);
    }
  }

  protected etiquetaEstado(e: EstadoPartido): string {
    return ETIQUETA_ESTADO[e];
  }
}
