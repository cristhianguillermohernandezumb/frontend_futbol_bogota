import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../../core/api-error';
import { AuthService } from '../../../core/auth.service';
import { Modalidad } from '../../../core/models';
import { FORMATOS_TORNEO, formatoDe } from '../../../core/eliminatorias';
import { OrganizadorService } from '../../../core/organizador.service';

/** La fecha de fin no puede ser anterior a la de inicio (el backend tambien lo valida). */
function fechasValidas(grupo: AbstractControl): ValidationErrors | null {
  const inicio = grupo.get('fechaInicio')?.value as string;
  const fin = grupo.get('fechaFin')?.value as string;
  return inicio && fin && fin < inicio ? { fechas: true } : null;
}

@Component({
  selector: 'app-torneo-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './torneo-form.html',
  styleUrl: './torneo-form.css',
})
export class TorneoForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly modalidades: { valor: Modalidad; texto: string }[] = [
    { valor: 'FUTBOL_5', texto: 'Fútbol 5' },
    { valor: 'FUTBOL_7', texto: 'Fútbol 7' },
    { valor: 'FUTBOL_8', texto: 'Fútbol 8' },
    { valor: 'FUTBOL_11', texto: 'Fútbol 11' },
  ];

  protected readonly form = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.maxLength(50)]],
      fechaInicio: ['', [Validators.required]],
      fechaFin: ['', [Validators.required]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]],
      modalidad: ['FUTBOL_7' as Modalidad, [Validators.required]],
      categoria: ['', [Validators.required, Validators.maxLength(20)]],
      costoInscripcion: [0, [Validators.required, Validators.min(0)]],
      maxEquipos: [24, [Validators.required]],
    },
    { validators: fechasValidas },
  );

  /** Formatos disponibles: 24 equipos (6 grupos, octavos) o 48 equipos (12 grupos, 32avos). */
  protected readonly formatos = FORMATOS_TORNEO;
  private readonly maxElegido = signal(24);
  protected readonly formatoElegido = computed(() => formatoDe(this.maxElegido()));

  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected elegirFormato(valor: string): void {
    this.maxElegido.set(Number(valor));
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected enviar(): void {
    this.intento.set(true);
    const usuario = this.auth.usuario();
    if (this.form.invalid || !usuario) {
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.organizador
      .crearTorneo({
        nombre: v.nombre.trim(),
        fechaInicio: v.fechaInicio,
        fechaFin: v.fechaFin,
        telefono: Number(v.telefono),
        modalidad: v.modalidad,
        categoria: v.categoria.trim().toUpperCase().replace(/\s+/g, '_'),
        costoInscripcion: Number(v.costoInscripcion),
        maxEquipos: Number(v.maxEquipos),
        idOrganizador: usuario.idUsuario,
      })
      .subscribe({
        next: (torneo) => void this.router.navigate(['/organizador/torneos', torneo.idTorneo]),
        error: (err: unknown) => {
          this.error.set(mensajeDeError(err));
          this.enviando.set(false);
        },
      });
  }
}
