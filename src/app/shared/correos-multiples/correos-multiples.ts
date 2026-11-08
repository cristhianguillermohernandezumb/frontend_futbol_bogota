import { Component, input, model } from '@angular/core';

const MAXIMO = 10;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Un correo es valido si esta vacio (se ignora) o tiene forma de direccion. */
export function correoValido(c: string): boolean {
  const t = c.trim();
  return t === '' || (t.length <= 100 && EMAIL.test(t));
}

/** Pregunta cuantos correos se van a insertar y habilita un campo por cada uno. */
@Component({
  selector: 'app-correos-multiples',
  template: `
    <div class="grupo">
      <label [for]="idBase() + '-cantidad'">
        ¿Cuántos correos va a insertar? <span class="ayuda">(0 a ${MAXIMO})</span>
      </label>
      <input
        [id]="idBase() + '-cantidad'"
        type="number"
        min="0"
        max="${MAXIMO}"
        [value]="correos().length"
        (change)="cambiarCantidad($any($event.target).value)"
      />
    </div>
    @for (c of correos(); track $index; let i = $index) {
      <div class="grupo">
        <label [for]="idBase() + '-' + i">Correo {{ i + 1 }}</label>
        <input
          [id]="idBase() + '-' + i"
          type="email"
          maxlength="100"
          [value]="c"
          (input)="editar(i, $any($event.target).value)"
          [attr.aria-invalid]="intento() && !correoValido(c)"
        />
        @if (intento() && !correoValido(c)) {
          <p class="error-campo">Escribe un correo válido.</p>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class CorreosMultiples {
  readonly correos = model<string[]>(['']);
  readonly intento = input(false);
  readonly idBase = input('correo');

  protected readonly correoValido = correoValido;

  protected cambiarCantidad(valor: string): void {
    const n = Math.min(MAXIMO, Math.max(0, Math.floor(Number(valor)) || 0));
    const actual = this.correos();
    this.correos.set(Array.from({ length: n }, (_, i) => actual[i] ?? ''));
  }

  protected editar(i: number, valor: string): void {
    this.correos.set(this.correos().map((c, j) => (j === i ? valor : c)));
  }
}
