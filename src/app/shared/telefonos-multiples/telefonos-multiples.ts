import { Component, input, model } from '@angular/core';

const MAXIMO = 10;
const TELEFONO = /^\d{7,20}$/;

/** Un telefono es valido si esta vacio (se ignora) o tiene de 7 a 20 digitos. */
export function telefonoValido(t: string): boolean {
  const v = t.trim();
  return v === '' || TELEFONO.test(v);
}

/** Pregunta cuantos telefonos se van a insertar y habilita un campo por cada uno. */
@Component({
  selector: 'app-telefonos-multiples',
  template: `
    <div class="grupo">
      <label [for]="idBase() + '-cantidad'">
        ¿Cuántos teléfonos va a insertar? <span class="ayuda">(0 a ${MAXIMO})</span>
      </label>
      <input
        [id]="idBase() + '-cantidad'"
        type="number"
        min="0"
        max="${MAXIMO}"
        [value]="telefonos().length"
        (change)="cambiarCantidad($any($event.target).value)"
      />
    </div>
    @for (t of telefonos(); track $index; let i = $index) {
      <div class="grupo">
        <label [for]="idBase() + '-' + i">Teléfono {{ i + 1 }}</label>
        <input
          [id]="idBase() + '-' + i"
          type="tel"
          inputmode="numeric"
          maxlength="20"
          [value]="t"
          (input)="editar(i, $any($event.target).value)"
          [attr.aria-invalid]="intento() && !telefonoValido(t)"
        />
        @if (intento() && !telefonoValido(t)) {
          <p class="error-campo">Solo números (7 a 20 dígitos).</p>
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
export class TelefonosMultiples {
  readonly telefonos = model<string[]>(['']);
  readonly intento = input(false);
  readonly idBase = input('telefono');

  protected readonly telefonoValido = telefonoValido;

  protected cambiarCantidad(valor: string): void {
    const n = Math.min(MAXIMO, Math.max(0, Math.floor(Number(valor)) || 0));
    const actual = this.telefonos();
    this.telefonos.set(Array.from({ length: n }, (_, i) => actual[i] ?? ''));
  }

  protected editar(i: number, valor: string): void {
    this.telefonos.set(this.telefonos().map((t, j) => (j === i ? valor : t)));
  }
}
