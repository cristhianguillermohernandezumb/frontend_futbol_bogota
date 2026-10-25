import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../../core/api-error';
import { AuthService } from '../../../core/auth.service';
import { EstadoTorneo, Torneo } from '../../../core/models';
import { OrganizadorService } from '../../../core/organizador.service';
import { TorneoService } from '../../../core/torneo.service';

const ETIQUETA_ESTADO: Record<EstadoTorneo, string> = {
  INSCRIPCION: 'Inscripciones abiertas',
  EN_CURSO: 'En juego',
  FINALIZADO: 'Finalizado',
};

@Component({
  selector: 'app-panel',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel implements OnInit {
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);
  protected readonly auth = inject(AuthService);

  protected readonly torneos = signal<Torneo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const usuario = this.auth.usuario();
    if (!usuario) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    // El admin ve todos los torneos; el organizador, solo los suyos.
    const consulta =
      usuario.rol === 'ADMIN' ? this.torneoService.listar() : this.organizador.torneosDe(usuario.idUsuario);
    consulta.subscribe({
      next: (lista) => {
        this.torneos.set([...lista].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)));
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected etiquetaEstado(e: EstadoTorneo): string {
    return ETIQUETA_ESTADO[e];
  }
}
