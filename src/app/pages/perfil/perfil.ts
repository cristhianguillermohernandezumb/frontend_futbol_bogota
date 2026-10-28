import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { mensajeDeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { EspectadorService } from '../../core/espectador.service';
import { Rol, Usuario } from '../../core/models';

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  ORGANIZADOR: 'Organizador',
  ESPECTADOR: 'Espectador',
};

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly servicio = inject(EspectadorService);

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    primerNombre: ['', [Validators.required, Validators.maxLength(50)]],
    segundoNombre: ['', [Validators.maxLength(50)]],
    primerApellido: ['', [Validators.required, Validators.maxLength(50)]],
    segundoApellido: ['', [Validators.maxLength(50)]],
    telefono: ['', [Validators.pattern(/^\d{7,15}$/)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    contrasenia: ['', [Validators.minLength(8), Validators.maxLength(72)]],
  });

  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);
  protected readonly guardado = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  protected etiquetaRol(rol: Rol): string {
    return ETIQUETA_ROL[rol];
  }

  protected cargar(): void {
    const sesion = this.auth.usuario();
    if (!sesion) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.perfil(sesion.idUsuario).subscribe({
      next: (u) => {
        this.poner(u);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  private poner(u: Usuario): void {
    this.usuario.set(u);
    this.form.reset({
      primerNombre: u.primerNombre,
      segundoNombre: u.segundoNombre,
      primerApellido: u.primerApellido,
      segundoApellido: u.segundoApellido,
      telefono: u.telefono ? String(u.telefono) : '',
      correo: u.correo,
      contrasenia: '',
    });
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected guardar(): void {
    this.intento.set(true);
    const u = this.usuario();
    if (this.form.invalid || !u) {
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.errorGuardar.set(null);
    this.guardado.set(false);
    this.servicio
      .actualizarPerfil(u.idUsuario, {
        primerNombre: v.primerNombre.trim(),
        segundoNombre: v.segundoNombre.trim(),
        primerApellido: v.primerApellido.trim(),
        segundoApellido: v.segundoApellido.trim(),
        telefono: v.telefono ? Number(v.telefono) : null,
        correo: v.correo.trim(),
        // Sin contrasena nueva no se envia el campo y el backend conserva la actual.
        ...(v.contrasenia ? { contrasenia: v.contrasenia } : {}),
      })
      .subscribe({
        next: (nuevo) => {
          this.poner(nuevo);
          this.auth.actualizarUsuario(nuevo);
          this.intento.set(false);
          this.guardando.set(false);
          this.guardado.set(true);
        },
        error: (err: unknown) => {
          this.errorGuardar.set(mensajeDeError(err));
          this.guardando.set(false);
        },
      });
  }
}
