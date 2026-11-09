import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { mensajeDeError } from '../../core/api-error';
import { Alineacion, EquipoDePartido } from '../../core/models';
import { TorneoService } from '../../core/torneo.service';

/** Alineacion de un partido, vista publica: solo jugadores y minutos jugados. */
@Component({
  selector: 'app-alineacion-partido',
  imports: [RouterLink],
  template: `
    <a class="volver" [routerLink]="['/torneos', idTorneo]" [queryParams]="{ pestana: 'partidos' }">← Volver al torneo</a>

    @if (cargando()) {
      <p class="mensaje" role="status">Cargando alineación…</p>
    } @else if (error(); as texto) {
      <div class="aviso aviso-error" role="alert">
        <p>{{ texto }}</p>
        <button type="button" class="enlace" (click)="cargar()">Reintentar</button>
      </div>
    } @else {
      <h1>Alineación</h1>
      <div class="equipos">
        @for (e of equiposConJugadores(); track e.idEquipo) {
          <section class="equipo" [attr.aria-label]="e.nombreEquipo">
            <h2>{{ e.nombreEquipo }}</h2>
            @if (e.jugadores.length === 0) {
              <p class="mensaje">Todavía no hay alineación registrada.</p>
            } @else {
              <ul class="jugadores">
                @for (j of e.jugadores; track j.idJugador) {
                  <li>
                    <span class="nombre">{{ j.nombreJugador }}</span>
                    <span class="minutos">{{ j.minutosJugados }}'</span>
                  </li>
                }
              </ul>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 46rem;
      margin: 0 auto;
      padding: 1.5rem clamp(1rem, 4vw, 2rem) 4rem;
    }

    .volver {
      display: inline-block;
      margin-bottom: 0.5rem;
      color: var(--texto-suave);
      font-weight: 500;
      text-decoration: none;
    }

    .volver:hover {
      color: var(--tinta);
      text-decoration: underline;
    }

    h1 {
      margin: 0 0 1.2rem;
      font-size: 2.2rem;
      text-align: center;
    }

    h2 {
      margin: 0 0 0.5rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid var(--linea);
      font-size: 1.35rem;
      text-align: center;
    }

    .mensaje {
      padding: 0.5rem 0;
      color: var(--texto-suave);
      text-align: center;
    }

    .equipos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .equipo {
      padding: 1rem 1.1rem 0.6rem;
      border: 1.5px solid var(--linea);
      border-radius: 8px;
      background: var(--papel);
    }

    .jugadores {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .jugadores li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--linea);
    }

    .jugadores li:last-child {
      border-bottom: 0;
    }

    .nombre {
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .minutos {
      flex: none;
      min-width: 2.6rem;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: var(--fondo, #eef1ec);
      color: var(--texto-suave);
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
    }
  `,})
export class AlineacionPartido implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);

  protected readonly idTorneo = Number(this.ruta.snapshot.paramMap.get('id'));
  private readonly idPartido = Number(this.ruta.snapshot.paramMap.get('idPartido'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly equipos = signal<EquipoDePartido[]>([]);
  private readonly alineacion = signal<Alineacion[]>([]);

  /** Local primero; dentro de cada equipo, titulares antes que suplentes. */
  protected readonly equiposConJugadores = computed(() =>
    [...this.equipos()]
      .sort((a, b) => (a.rol === 'LOCAL' ? -1 : 1) - (b.rol === 'LOCAL' ? -1 : 1))
      .map((e) => ({
        ...e,
        jugadores: this.alineacion()
          .filter((a) => a.idEquipo === e.idEquipo)
          .sort((a, b) => (a.titular === b.titular ? a.nombreJugador.localeCompare(b.nombreJugador) : a.titular === 'S' ? -1 : 1)),
      })),
  );

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      equipos: this.torneoService.equiposDePartido(this.idPartido),
      alineacion: this.torneoService.alineacion(this.idPartido),
    }).subscribe({
      next: ({ equipos, alineacion }) => {
        this.equipos.set(equipos);
        this.alineacion.set(alineacion);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }
}
