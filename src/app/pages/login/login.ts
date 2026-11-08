import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';

/** Solo se acepta volver a rutas internas, para que nadie pueda mandar al usuario a otro sitio. */
function destinoSeguro(destino: string | null): string {
  return destino && destino.startsWith('/') && !destino.startsWith('//') ? destino : '/';
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly form = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasenia: ['', [Validators.required]],
  });

  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly expirada = this.ruta.snapshot.queryParamMap.get('motivo') === 'expirada';
  protected readonly registrado = this.ruta.snapshot.queryParamMap.get('registrado') === '1';
  protected readonly pendiente = this.ruta.snapshot.queryParamMap.get('registrado') === '2';

  protected enviar(): void {
    this.intento.set(true);
    if (this.form.invalid) {
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        void this.router.navigateByUrl(destinoSeguro(this.ruta.snapshot.queryParamMap.get('volver')));
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.enviando.set(false);
      },
    });
  }
}
