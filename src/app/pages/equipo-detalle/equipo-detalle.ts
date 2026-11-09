import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { mensajeDeError } from '../../core/api-error';
import { EntrenadorPublico, EquipoInscrito, JugadorInscrito } from '../../core/models';
import { TorneoService } from '../../core/torneo.service';
import { EscudoEquipo } from '../../shared/escudo-equipo/escudo-equipo';

@Component({
  selector: 'app-equipo-detalle',
  imports: [RouterLink, EscudoEquipo],
  templateUrl: './equipo-detalle.html',
  styleUrl: './equipo-detalle.css',
})
export class EquipoDetalle implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);

  protected readonly idTorneo = Number(this.ruta.snapshot.paramMap.get('id'));
  protected readonly idEquipo = Number(this.ruta.snapshot.paramMap.get('idEquipo'));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly equipo = signal<EquipoInscrito | null>(null);
  protected readonly jugadores = signal<JugadorInscrito[]>([]);
  protected readonly entrenadores = signal<EntrenadorPublico[]>([]);

  protected readonly plantilla = computed(() =>
    [...this.jugadores()].sort((a, b) => a.numeroCamiseta - b.numeroCamiseta),
  );

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    if (!this.idTorneo || !this.idEquipo) {
      this.error.set('No encontramos este equipo.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      equipos: this.torneoService.equipos(this.idTorneo),
      jugadores: this.torneoService.jugadoresDeEquipo(this.idTorneo, this.idEquipo),
      entrenadores: this.torneoService.entrenadoresDeEquipo(this.idTorneo, this.idEquipo),
    }).subscribe({
      next: ({ equipos, jugadores, entrenadores }) => {
        const equipo = equipos.find((e) => e.idEquipo === this.idEquipo) ?? null;
        if (!equipo) {
          this.error.set('Este equipo no está inscrito en el torneo.');
        }
        this.equipo.set(equipo);
        this.jugadores.set(jugadores);
        this.entrenadores.set(entrenadores);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected nombre(e: EntrenadorPublico): string {
    return [e.primerNombre, e.segundoNombre, e.primerApellido, e.segundoApellido].filter(Boolean).join(' ');
  }

  protected etiquetaPierna(pierna: string): string {
    return pierna ? pierna.charAt(0) + pierna.slice(1).toLowerCase() : '';
  }
}
