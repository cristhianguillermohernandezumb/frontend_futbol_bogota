import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.group({
    primerNombre: ['', [Validators.required, Validators.maxLength(50)]],
    segundoNombre: ['', [Validators.maxLength(50)]],
    primerApellido: ['', [Validators.required, Validators.maxLength(50)]],
    segundoApellido: ['', [Validators.maxLength(50)]],
    telefono: ['', [Validators.pattern(/^\d{7,15}$/)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    contrasenia: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    rol: ['ESPECTADOR' as 'ESPECTADOR' | 'ORGANIZADOR', [Validators.required]],
  });

  protected readonly roles = [
    { valor: 'ESPECTADOR' as const, titulo: 'Seguir torneos', texto: 'Consulta partidos y tablas, y recibe avisos.' },
    { valor: 'ORGANIZADOR' as const, titulo: 'Organizar torneos', texto: 'Crea torneos, equipos y partidos.' },
  ];

  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Un campo muestra error solo despues de intentar enviar. */
  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected enviar(): void {
    this.intento.set(true);
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.auth
      .registrar({
        primerNombre: v.primerNombre.trim(),
        segundoNombre: v.segundoNombre.trim(),
        primerApellido: v.primerApellido.trim(),
        segundoApellido: v.segundoApellido.trim(),
        telefono: v.telefono ? Number(v.telefono) : null,
        correo: v.correo.trim(),
        contrasenia: v.contrasenia,
        rol: v.rol,
      })
      .subscribe({
        next: () => {
          void this.router.navigate(['/login'], { queryParams: { registrado: v.rol === 'ORGANIZADOR' ? 2 : 1 } });
        },
        error: (err: unknown) => {
          this.error.set(mensajeDeError(err));
          this.enviando.set(false);
        },
      });
  }
}
