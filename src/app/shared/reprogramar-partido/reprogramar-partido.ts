import { Component, OnInit, inject, input, output, signal } from '@angular/core';

import { mensajeDeError } from '../../core/api-error';
import { Cancha, Partido } from '../../core/models';
import { OrganizadorService } from '../../core/organizador.service';

/** Pide la nueva fecha (y cancha) de un partido aplazado y lo vuelve a programar. */
@Component({
  selector: 'app-reprogramar-partido',
  template: `
    <div class="formulario">
      <p>Elige la nueva fecha y hora del partido aplazado.</p>
      @if (error(); as texto) {
        <p class="aviso aviso-error" role="alert">{{ texto }}</p>
      }
      <div class="rejilla">
        <div class="grupo">
          <label [for]="'rep-fecha-' + partido().idPartido">Nueva fecha y hora</label>
          <input
            [id]="'rep-fecha-' + partido().idPartido"
            type="datetime-local"
            [min]="min()"
            [max]="max()"
            [value]="fecha()"
            (input)="fecha.set($any($event.target).value)"
            [attr.aria-invalid]="intento() && !fecha()"
          />
          @if (intento() && !fecha()) {
            <p class="error-campo">Elige la nueva fecha y hora.</p>
          }
        </div>
        <div class="grupo">
          <label [for]="'rep-cancha-' + partido().idPartido">Cancha</label>
          <select
            [id]="'rep-cancha-' + partido().idPartido"
            (change)="idCancha.set(+$any($event.target).value)"
          >
            @for (c of canchas(); track c.idCancha) {
              <option [value]="c.idCancha" [selected]="c.idCancha === idCancha()">{{ c.nombre }}</option>
            }
          </select>
        </div>
      </div>
      <div class="botones">
        <button type="button" class="boton boton-peto" [disabled]="guardando()" (click)="guardar()">
          {{ guardando() ? 'Guardando…' : 'Reprogramar' }}
        </button>
        <button type="button" class="boton boton-borde" [disabled]="guardando()" (click)="cancelar.emit()">Cancelar</button>
      </div>
    </div>
  `,
})
export class ReprogramarPartido implements OnInit {
  readonly partido = input.required<Partido>();
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly hecho = output<void>();
  readonly cancelar = output<void>();

  private readonly organizador = inject(OrganizadorService);

  protected readonly canchas = signal<Cancha[]>([]);
  protected readonly fecha = signal('');
  protected readonly idCancha = signal(0);
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.idCancha.set(this.partido().idCancha);
    this.organizador.canchas().subscribe({
      next: (lista) => this.canchas.set(lista),
      error: (err: unknown) => this.error.set(mensajeDeError(err)),
    });
  }

  protected guardar(): void {
    this.intento.set(true);
    this.error.set(null);
    if (!this.fecha()) {
      return;
    }
    if (this.fecha() === this.partido().fechaHora.slice(0, 16) && this.idCancha() === this.partido().idCancha) {
      this.error.set('Elige una fecha u hora distinta a la anterior.');
      return;
    }
    this.guardando.set(true);
    this.organizador.reprogramarPartido(this.partido(), this.fecha(), this.idCancha()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.hecho.emit();
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.guardando.set(false);
      },
    });
  }
}
