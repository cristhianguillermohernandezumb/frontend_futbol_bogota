import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { EspectadorService } from '../../core/espectador.service';
import { Seguimiento } from '../../core/models';

@Component({
  selector: 'app-seguimientos',
  imports: [RouterLink, DatePipe],
  templateUrl: './seguimientos.html',
  styleUrl: './seguimientos.css',
})
export class Seguimientos implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly servicio = inject(EspectadorService);

  protected readonly lista = signal<Seguimiento[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly trabajando = signal<number | null>(null);
  protected readonly confirmando = signal<number | null>(null);

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
    this.servicio.seguimientos(usuario.idUsuario).subscribe({
      next: (l) => {
        this.lista.set([...l].sort((a, b) => b.fechaSeguimiento.localeCompare(a.fechaSeguimiento)));
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected cambiarAvisos(s: Seguimiento): void {
    const usuario = this.auth.usuario();
    if (!usuario) {
      return;
    }
    this.errorAccion.set(null);
    this.trabajando.set(s.idTorneo);
    this.servicio.cambiarAvisos(usuario.idUsuario, s.idTorneo, s.notificacion !== 'S').subscribe({
      next: (nuevo) => {
        this.lista.update((l) => l.map((x) => (x.idTorneo === nuevo.idTorneo ? nuevo : x)));
        this.trabajando.set(null);
      },
      error: (err: unknown) => {
        this.errorAccion.set(mensajeDeError(err));
        this.trabajando.set(null);
      },
    });
  }

  protected dejar(s: Seguimiento): void {
    const usuario = this.auth.usuario();
    if (!usuario) {
      return;
    }
    this.errorAccion.set(null);
    this.trabajando.set(s.idTorneo);
    this.servicio.dejarDeSeguir(usuario.idUsuario, s.idTorneo).subscribe({
      next: () => {
        this.lista.update((l) => l.filter((x) => x.idTorneo !== s.idTorneo));
        this.confirmando.set(null);
        this.trabajando.set(null);
      },
      error: (err: unknown) => {
        this.errorAccion.set(mensajeDeError(err));
        this.confirmando.set(null);
        this.trabajando.set(null);
      },
    });
  }
}
