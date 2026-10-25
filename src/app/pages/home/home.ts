import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { EstadoTorneo, Modalidad, Torneo } from '../../core/models';
import { TorneoService } from '../../core/torneo.service';

const NUMERAL: Record<Modalidad, string> = {
  FUTBOL_5: '5v5',
  FUTBOL_7: '7v7',
  FUTBOL_8: '8v8',
  FUTBOL_11: '11v11',
};

const ETIQUETA_ESTADO: Record<EstadoTorneo, string> = {
  INSCRIPCION: 'Inscripciones abiertas',
  EN_CURSO: 'En juego',
  FINALIZADO: 'Finalizado',
};

/** Orden de la lista: primero lo que se esta jugando, luego lo que abre inscripciones, al final lo terminado. */
const PRIORIDAD: Record<EstadoTorneo, number> = { EN_CURSO: 0, INSCRIPCION: 1, FINALIZADO: 2 };

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly torneoService = inject(TorneoService);
  protected readonly auth = inject(AuthService);

  protected readonly filtros: { valor: EstadoTorneo | null; texto: string }[] = [
    { valor: null, texto: 'Todos' },
    { valor: 'INSCRIPCION', texto: 'Inscripciones abiertas' },
    { valor: 'EN_CURSO', texto: 'En juego' },
    { valor: 'FINALIZADO', texto: 'Finalizados' },
  ];

  protected readonly filtro = signal<EstadoTorneo | null>(null);
  protected readonly torneos = signal<Torneo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Evita que una respuesta lenta pise a una mas reciente cuando se cambia rapido de filtro. */
  private peticion = 0;

  ngOnInit(): void {
    this.cargar();
  }

  protected elegir(valor: EstadoTorneo | null): void {
    this.filtro.set(valor);
    this.cargar();
  }

  protected cargar(): void {
    const numero = ++this.peticion;
    this.cargando.set(true);
    this.error.set(null);
    this.torneoService.listar(this.filtro()).subscribe({
      next: (lista) => {
        if (numero !== this.peticion) {
          return;
        }
        this.torneos.set(this.ordenar(lista));
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        if (numero !== this.peticion) {
          return;
        }
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected numeral(modalidad: Modalidad): string {
    return NUMERAL[modalidad];
  }

  protected etiquetaEstado(estado: EstadoTorneo): string {
    return ETIQUETA_ESTADO[estado];
  }

  protected claseEstado(estado: EstadoTorneo): string {
    return `estado estado-${estado.toLowerCase()}`;
  }

  private ordenar(lista: Torneo[]): Torneo[] {
    return [...lista].sort(
      (a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado] || a.fechaInicio.localeCompare(b.fechaInicio),
    );
  }
}
