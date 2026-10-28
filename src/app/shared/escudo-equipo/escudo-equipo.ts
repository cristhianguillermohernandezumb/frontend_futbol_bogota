import { Component, computed, effect, input, signal } from '@angular/core';

import { API_URL } from '../../core/config';

/**
 * Escudo de un equipo. Pide la imagen al backend; si el equipo no tiene una (404), muestra un circulo con sus iniciales.
 * `version` sirve para forzar la recarga despues de cambiar el escudo.
 */
@Component({
  selector: 'app-escudo-equipo',
  template: `
    @if (!fallo()) {
      <img class="imagen" [src]="url()" alt="" (error)="fallo.set(true)" />
    } @else {
      <span class="iniciales" aria-hidden="true">{{ iniciales() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      width: var(--escudo, 3rem);
      height: var(--escudo, 3rem);
    }

    .imagen {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .iniciales {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--tinta);
      color: var(--tiza);
      font-family: var(--fuente-titulo);
      font-size: calc(var(--escudo, 3rem) * 0.42);
      font-weight: 700;
      letter-spacing: 0.02em;
    }
  `,
})
export class EscudoEquipo {
  readonly idEquipo = input.required<number>();
  readonly nombre = input.required<string>();
  readonly version = input(0);

  protected readonly fallo = signal(false);
  protected readonly url = computed(() => `${API_URL}/equipos/${this.idEquipo()}/escudo?v=${this.version()}`);
  protected readonly iniciales = computed(() =>
    this.nombre()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  constructor() {
    // Si cambia el equipo o la version, se vuelve a intentar con la imagen.
    effect(() => {
      this.url();
      this.fallo.set(false);
    });
  }
}
