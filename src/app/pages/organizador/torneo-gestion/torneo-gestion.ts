import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../../core/api-error';
import { AuthService } from '../../../core/auth.service';
import { EstadoTorneo, Modalidad, Torneo } from '../../../core/models';
import { formatoDe } from '../../../core/eliminatorias';
import { OrganizadorService } from '../../../core/organizador.service';
import { TorneoService } from '../../../core/torneo.service';
import { CrucesGestion } from './cruces-gestion/cruces-gestion';
import { EntrenadoresGestion } from './entrenadores-gestion/entrenadores-gestion';
import { EquiposGestion } from './equipos-gestion/equipos-gestion';
import { GruposGestion } from './grupos-gestion/grupos-gestion';
import { JugadoresGestion } from './jugadores-gestion/jugadores-gestion';
import { PartidosEliminatoria } from './partidos-eliminatoria/partidos-eliminatoria';
import { PartidosGestion } from './partidos-gestion/partidos-gestion';

type Pestana = 'resumen' | 'equipos' | 'jugadores' | 'entrenadores' | 'grupos' | 'partidos' | 'cruces' | 'eliminatorias';

const NUMERAL: Record<Modalidad, string> = { FUTBOL_5: '5v5', FUTBOL_7: '7v7', FUTBOL_8: '8v8', FUTBOL_11: '11v11' };

const ETIQUETA_ESTADO: Record<EstadoTorneo, string> = {
  INSCRIPCION: 'Inscripciones abiertas',
  EN_CURSO: 'En juego',
  FINALIZADO: 'Finalizado',
};

/** Siguiente etapa del torneo: INSCRIPCION -> EN_CURSO -> FINALIZADO. */
const SIGUIENTE: Record<EstadoTorneo, { valor: EstadoTorneo; boton: string; aviso: string } | null> = {
  INSCRIPCION: {
    valor: 'EN_CURSO',
    boton: 'Iniciar torneo',
    aviso: 'Se cierran las inscripciones y se pueden empezar los partidos. Se necesitan al menos 2 equipos.',
  },
  EN_CURSO: {
    valor: 'FINALIZADO',
    boton: 'Finalizar torneo',
    aviso: 'El torneo queda cerrado y ya no se podrá modificar.',
  },
  FINALIZADO: null,
};

@Component({
  selector: 'app-torneo-gestion',
  imports: [RouterLink, DatePipe, CurrencyPipe, EquiposGestion, JugadoresGestion, EntrenadoresGestion, GruposGestion, PartidosGestion, CrucesGestion, PartidosEliminatoria],
  templateUrl: './torneo-gestion.html',
  styleUrl: './torneo-gestion.css',
})
export class TorneoGestion implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly organizador = inject(OrganizadorService);
  protected readonly auth = inject(AuthService);

  protected readonly pestanas = computed<{ id: Pestana; texto: string }[]>(() => [
    { id: 'resumen', texto: 'Resumen' },
    { id: 'equipos', texto: 'Equipos' },
    { id: 'jugadores', texto: 'Jugadores' },
    { id: 'entrenadores', texto: 'Entrenadores' },
    { id: 'grupos', texto: 'Grupos' },
    { id: 'partidos', texto: 'Partidos' },
    { id: 'cruces', texto: formatoDe(this.torneo()?.maxEquipos).primera.titulo },
    { id: 'eliminatorias', texto: 'Partidos tras fase de grupos' },
  ]);

  protected readonly pestana = signal<Pestana>('resumen');
  protected readonly torneo = signal<Torneo | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly confirmando = signal(false);
  protected readonly cambiando = signal(false);
  protected readonly errorEstado = signal<string | null>(null);

  /** Solo el dueno del torneo (o un admin) puede modificarlo; el backend lo exige igual. */
  protected readonly esDueno = computed(() => {
    const t = this.torneo();
    const u = this.auth.usuario();
    return !!t && !!u && (u.rol === 'ADMIN' || u.idUsuario === t.idOrganizador);
  });

  protected readonly siguiente = computed(() => {
    const t = this.torneo();
    return t ? SIGUIENTE[t.estado] : null;
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
    this.torneoService.obtener(id).subscribe({
      next: (t) => {
        if (id === this.id) {
          this.torneo.set(t);
          this.cargando.set(false);
        }
      },
      error: (err: unknown) => {
        if (id === this.id) {
          this.error.set(mensajeDeError(err));
          this.cargando.set(false);
        }
      },
    });
  }

  protected elegir(p: Pestana): void {
    this.pestana.set(p);
  }

  protected cambiarEstado(): void {
    const sig = this.siguiente();
    if (!sig) {
      return;
    }
    this.cambiando.set(true);
    this.errorEstado.set(null);
    this.organizador.cambiarEstadoTorneo(this.id, sig.valor).subscribe({
      next: (t) => {
        this.torneo.set(t);
        this.confirmando.set(false);
        this.cambiando.set(false);
      },
      error: (err: unknown) => {
        this.errorEstado.set(mensajeDeError(err));
        this.cambiando.set(false);
      },
    });
  }

  protected numeral(m: Modalidad): string {
    return NUMERAL[m];
  }

  protected etiquetaEstado(e: EstadoTorneo): string {
    return ETIQUETA_ESTADO[e];
  }
}
