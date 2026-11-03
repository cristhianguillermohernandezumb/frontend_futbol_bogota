import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import {
  EquipoClasificado,
  calcularClasificados,
  calcularTablasDeGrupos,
  listarClasificados,
} from '../../../../core/clasificacion';
import { RONDA_32AVOS, esFase, faseDeGruposTerminada } from '../../../../core/eliminatorias';
import { Cruce, GrupoConEquipos, PartidoConEquipos, Penales, Posicion, Torneo } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';
import { CuadroEliminatoria } from '../../../../shared/cuadro-eliminatoria/cuadro-eliminatoria';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

interface Par {
  local: number | null;
  visitante: number | null;
}

type Modo = 'random' | 'manual';

function barajar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

@Component({
  selector: 'app-cruces-gestion',
  imports: [FormsModule, CuadroEliminatoria],
  templateUrl: './cruces-gestion.html',
  styleUrl: './cruces-gestion.css',
})
export class CrucesGestion implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly titulo = RONDA_32AVOS.titulo;
  protected readonly cantidad = RONDA_32AVOS.cruces;

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);

  private readonly grupos = signal<GrupoConEquipos[]>([]);
  private readonly posiciones = signal<Posicion[]>([]);
  protected readonly partidos = signal<PartidoConEquipos[]>([]);
  protected readonly penales = signal<Penales[]>([]);
  protected readonly cruces = signal<Cruce[]>([]);

  protected readonly modo = signal<Modo | null>(null);
  protected readonly borrador = signal<Par[]>([]);
  protected readonly editando = signal(false);
  protected readonly confirmandoBorrar = signal(false);

  protected readonly puedeModificar = computed(() => this.torneo().estado !== 'FINALIZADO');
  protected readonly gruposTerminados = computed(() => faseDeGruposTerminada(this.partidos()));
  protected readonly pendientesGrupos = computed(
    () => this.partidos().filter((p) => esFase(p, 'Grupos') && p.estado !== 'FINALIZADO').length,
  );
  protected readonly clasificados = computed(() =>
    calcularClasificados(calcularTablasDeGrupos(this.grupos(), this.posiciones())),
  );
  protected readonly equipos = computed<EquipoClasificado[]>(() => {
    const c = this.clasificados();
    return c ? listarClasificados(c) : [];
  });
  protected readonly porId = computed(() => new Map(this.equipos().map((e) => [e.idEquipo, e])));
  protected readonly hayPartidosDeRonda = computed(() => this.partidos().some((p) => esFase(p, RONDA_32AVOS.fase)));

  protected readonly usados = computed(() => {
    const s = new Set<number>();
    for (const p of this.borrador()) {
      if (p.local) s.add(p.local);
      if (p.visitante) s.add(p.visitante);
    }
    return s;
  });
  protected readonly completos = computed(
    () => this.borrador().filter((p) => p.local !== null && p.visitante !== null).length,
  );
  protected readonly listoParaGuardar = computed(() => this.completos() === this.cantidad);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const id = this.torneo().idTorneo;
    this.cargando.set(true);
    this.errorCarga.set(null);
    forkJoin({
      grupos: this.torneoService.grupos(id),
      posiciones: this.torneoService.posiciones(id),
      partidos: this.torneoService.partidos(id),
      cruces: this.torneoService.cruces(id, RONDA_32AVOS.codigo),
      // Dato extra (quien paso por penales): si falla, el resto de la pestaña sigue funcionando.
      penales: this.torneoService.penalesDeTorneo(id).pipe(catchError(() => of([] as Penales[]))),
    }).subscribe({
      next: (r) => {
        this.grupos.set(r.grupos);
        this.posiciones.set(r.posiciones);
        this.partidos.set(r.partidos);
        this.penales.set(r.penales);
        this.cruces.set(r.cruces);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  // ---- armado del borrador ----

  protected elegirModo(m: Modo): void {
    this.mensaje.set(null);
    this.modo.set(m);
    this.editando.set(true);
    this.borrador.set(m === 'random' ? this.sortear() : Array.from({ length: this.cantidad }, () => ({ local: null, visitante: null })));
  }

  protected volverASortear(): void {
    this.borrador.set(this.sortear());
  }

  /** Reparte los 32 clasificados al azar en 16 cruces, evitando (si se puede) que se enfrenten dos del mismo grupo. */
  private sortear(): Par[] {
    const equipos = this.equipos();
    let mejor: Par[] = [];
    let menorChoques = Infinity;
    for (let intento = 0; intento < 300 && menorChoques > 0; intento++) {
      const mezclados = barajar(equipos);
      const pares: Par[] = [];
      let choques = 0;
      for (let i = 0; i < mezclados.length; i += 2) {
        pares.push({ local: mezclados[i].idEquipo, visitante: mezclados[i + 1].idEquipo });
        if (mezclados[i].letra === mezclados[i + 1].letra) {
          choques++;
        }
      }
      if (choques < menorChoques) {
        menorChoques = choques;
        mejor = pares;
      }
    }
    return mejor;
  }

  protected elegir(i: number, lado: 'local' | 'visitante', valor: string): void {
    const id = valor ? Number(valor) : null;
    this.borrador.update((b) => b.map((p, k) => (k === i ? { ...p, [lado]: id } : p)));
  }

  /** Equipos que se pueden elegir en una casilla: los libres mas el que ya tiene esa casilla. */
  protected opciones(actual: number | null): EquipoClasificado[] {
    const usados = this.usados();
    return this.equipos().filter((e) => e.idEquipo === actual || !usados.has(e.idEquipo));
  }

  protected etiqueta(e: EquipoClasificado): string {
    return `${e.nombre} (${e.puesto}.º ${e.letra})`;
  }

  protected mismoGrupo(p: Par): boolean {
    const a = p.local ? this.porId().get(p.local) : null;
    const b = p.visitante ? this.porId().get(p.visitante) : null;
    return !!a && !!b && a.letra === b.letra;
  }

  protected nombre(id: number | null): string {
    return (id ? this.porId().get(id)?.nombre : null) ?? '';
  }

  protected cancelar(): void {
    this.modo.set(null);
    this.editando.set(false);
    this.borrador.set([]);
  }

  protected guardar(): void {
    if (!this.listoParaGuardar() || this.trabajando()) {
      return;
    }
    this.trabajando.set(true);
    this.mensaje.set(null);
    const lista = this.borrador().map((p) => ({ idLocal: p.local as number, idVisitante: p.visitante as number }));
    this.organizador.guardarCruces(this.torneo().idTorneo, RONDA_32AVOS.codigo, lista).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.cancelar();
        this.mensaje.set({ tipo: 'ok', texto: `Cruces de ${this.titulo} guardados.` });
        this.cargar();
      },
      error: (err: unknown) => {
        this.trabajando.set(false);
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
      },
    });
  }

  protected borrar(): void {
    this.trabajando.set(true);
    this.mensaje.set(null);
    this.confirmandoBorrar.set(false);
    this.organizador.borrarCruces(this.torneo().idTorneo, RONDA_32AVOS.codigo).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.mensaje.set({ tipo: 'ok', texto: 'Cruces borrados.' });
        this.cargar();
      },
      error: (err: unknown) => {
        this.trabajando.set(false);
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
      },
    });
  }
}
