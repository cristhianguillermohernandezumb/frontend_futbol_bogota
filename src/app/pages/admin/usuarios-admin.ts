import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../core/admin.service';
import { mensajeDeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Rol, Usuario } from '../../core/models';

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  ORGANIZADOR: 'Organizador',
  ESPECTADOR: 'Espectador',
};

/** Accion pendiente de confirmar sobre una fila. */
type Pendiente = { id: number; tipo: 'rol'; rol: Rol } | { id: number; tipo: 'estado' };

@Component({
  selector: 'app-usuarios-admin',
  imports: [FormsModule, DatePipe],
  templateUrl: './usuarios-admin.html',
  styleUrl: './usuarios-admin.css',
})
export class UsuariosAdmin implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  protected readonly roles: Rol[] = ['ESPECTADOR', 'ORGANIZADOR', 'ADMIN'];
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);
  protected readonly trabajando = signal<number | null>(null);
  protected readonly pendiente = signal<Pendiente | null>(null);

  protected readonly texto = signal('');
  protected readonly filtroRol = signal<'' | Rol>('');
  protected readonly filtroEstado = signal<'' | 'ACTIVO' | 'INACTIVO'>('');

  protected readonly yo = computed(() => this.auth.usuario()?.idUsuario ?? null);

  protected readonly visibles = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.usuarios().filter((u) => {
      if (this.filtroRol() && u.rol !== this.filtroRol()) {
        return false;
      }
      if (this.filtroEstado() && u.estado !== this.filtroEstado()) {
        return false;
      }
      return !t || `${this.nombre(u)} ${u.correo}`.toLowerCase().includes(t);
    });
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.admin.usuarios().subscribe({
      next: (lista) => {
        this.usuarios.set([...lista].sort((a, b) => this.nombre(a).localeCompare(this.nombre(b), 'es')));
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected nombre(u: Usuario): string {
    return [u.primerNombre, u.segundoNombre, u.primerApellido, u.segundoApellido].filter(Boolean).join(' ');
  }

  protected etiquetaRol(rol: Rol): string {
    return ETIQUETA_ROL[rol];
  }

  protected rolPendiente(u: Usuario): Rol | null {
    const p = this.pendiente();
    return p && p.id === u.idUsuario && p.tipo === 'rol' ? p.rol : null;
  }

  protected estadoPendiente(u: Usuario): boolean {
    const p = this.pendiente();
    return !!p && p.id === u.idUsuario && p.tipo === 'estado';
  }

  /** El select cambio: no se aplica hasta confirmar. */
  protected elegirRol(u: Usuario, rol: Rol): void {
    this.exito.set(null);
    this.errorAccion.set(null);
    this.pendiente.set(rol === u.rol ? null : { id: u.idUsuario, tipo: 'rol', rol });
  }

  protected pedirEstado(u: Usuario): void {
    this.exito.set(null);
    this.errorAccion.set(null);
    this.pendiente.set({ id: u.idUsuario, tipo: 'estado' });
  }

  protected confirmar(u: Usuario): void {
    const p = this.pendiente();
    if (!p || p.id !== u.idUsuario) {
      return;
    }
    this.trabajando.set(u.idUsuario);
    const accion =
      p.tipo === 'rol'
        ? this.admin.cambiarRol(u.idUsuario, p.rol)
        : u.estado === 'ACTIVO'
          ? this.admin.desactivar(u.idUsuario)
          : this.admin.activar(u.idUsuario);
    accion.subscribe({
      next: (nuevo) => {
        this.usuarios.update((l) => l.map((x) => (x.idUsuario === nuevo.idUsuario ? nuevo : x)));
        this.exito.set(
          p.tipo === 'rol'
            ? `${this.nombre(nuevo)} ahora es ${this.etiquetaRol(nuevo.rol).toLowerCase()}.`
            : `${this.nombre(nuevo)} quedó ${nuevo.estado === 'ACTIVO' ? 'activo' : 'inactivo'}.`,
        );
        this.pendiente.set(null);
        this.trabajando.set(null);
      },
      error: (err: unknown) => {
        this.errorAccion.set(mensajeDeError(err));
        this.pendiente.set(null);
        this.trabajando.set(null);
      },
    });
  }
}
