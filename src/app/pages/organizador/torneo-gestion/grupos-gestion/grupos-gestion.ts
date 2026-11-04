import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, concatMap, from, mergeMap, toArray } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { EquipoDeGrupo, EquipoInscrito, Grupo, GrupoConEquipos, Torneo } from '../../../../core/models';
import { formatoDe } from '../../../../core/eliminatorias';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';

type Modo = 'random' | 'manual';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Cuantas llamadas al backend se hacen a la vez al armar muchos grupos. */
const PARALELO = 4;
const FASE = 1;

/** Reparte n equipos en el menor numero de grupos de como maximo `tamano` equipos, lo mas parejos posible. */
export function tamanosDeGrupos(n: number, tamano: number): number[] {
  if (n < 1 || tamano < 1) {
    return [];
  }
  const cantidad = Math.ceil(n / tamano);
  const base = Math.floor(n / cantidad);
  const extra = n % cantidad;
  return Array.from({ length: cantidad }, (_, i) => base + (i < extra ? 1 : 0));
}

function barajar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

@Component({
  selector: 'app-grupos-gestion',
  imports: [FormsModule],
  templateUrl: './grupos-gestion.html',
  styleUrl: './grupos-gestion.css',
})
export class GruposGestion implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly inscritos = signal<EquipoInscrito[]>([]);
  protected readonly grupos = signal<GrupoConEquipos[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly progreso = signal<string | null>(null);

  protected readonly modo = signal<Modo | null>(null);
  /** El formato del torneo (24 o 48 equipos) ya define los grupos: siempre de 4 equipos. */
  protected readonly formato = computed(() => formatoDe(this.torneo().maxEquipos));
  protected readonly tamano = computed(() => this.formato().tamanoGrupo);
  protected readonly confirmandoSorteo = signal(false);
  protected readonly confirmandoBorrarTodo = signal(false);
  protected readonly confirmandoEliminar = signal<number | null>(null);

  protected readonly letraNueva = signal('');
  /** Equipo elegido en el selector de cada grupo (idGrupo -> idEquipo). */
  protected readonly elegidoPorGrupo = signal<Record<number, number>>({});

  protected readonly puedeModificar = computed(() => this.torneo().estado !== 'FINALIZADO');

  protected readonly sinGrupo = computed(() => {
    const asignados = new Set(this.grupos().flatMap((g) => g.equipos.map((e) => e.idEquipo)));
    return this.inscritos().filter((e) => !asignados.has(e.idEquipo));
  });

  protected readonly letrasLibres = computed(() => {
    const usadas = new Set(this.grupos().map((g) => g.letra));
    return LETRAS.filter((l) => !usadas.has(l));
  });

  /** Vista previa del sorteo: cuantos grupos salen y de que tamano. */
  protected readonly plan = computed(() => {
    const n = this.inscritos().length;
    const tamano = this.tamano();
    if (!Number.isInteger(tamano) || tamano < 2) {
      return { error: 'El tamaño del grupo debe ser un número entero de 2 o más.', tamanos: [] as number[], texto: '' };
    }
    if (n < 2) {
      return { error: 'Inscribe al menos 2 equipos para hacer grupos.', tamanos: [] as number[], texto: '' };
    }
    const tamanos = tamanosDeGrupos(n, tamano);
    if (tamanos.length > LETRAS.length) {
      return { error: `Saldrían ${tamanos.length} grupos y solo hay letras de la A a la Z (26).`, tamanos, texto: '' };
    }
    const cuenta = new Map<number, number>();
    tamanos.forEach((t) => cuenta.set(t, (cuenta.get(t) ?? 0) + 1));
    const partes = [...cuenta.entries()].sort((a, b) => b[0] - a[0]).map(([t, c]) => `${c} de ${t}`);
    const texto =
      cuenta.size === 1
        ? `${tamanos.length} ${tamanos.length === 1 ? 'grupo' : 'grupos'} de ${tamanos[0]} equipos`
        : `${tamanos.length} grupos (${partes.join(' y ')} equipos)`;
    return { error: null, tamanos, texto };
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.torneoService.equipos(this.torneo().idTorneo).subscribe({
      next: (lista) => {
        this.inscritos.set(lista);
        this.cargarGrupos();
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  private cargarGrupos(alTerminar?: () => void): void {
    this.torneoService.grupos(this.torneo().idTorneo).subscribe({
      next: (lista) => {
        this.grupos.set(lista);
        this.letraNueva.set(this.letrasLibres()[0] ?? '');
        this.cargando.set(false);
        alTerminar?.();
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeDeError(err));
        this.cargando.set(false);
        alTerminar?.();
      },
    });
  }

  protected elegirModo(m: Modo): void {
    this.modo.set(this.modo() === m ? null : m);
    this.confirmandoSorteo.set(false);
    this.mensaje.set(null);
  }

  // ---- Random ----

  protected pedirSorteo(): void {
    if (this.plan().error || this.trabajando()) {
      return;
    }
    if (this.grupos().length > 0) {
      this.confirmandoSorteo.set(true);
    } else {
      this.sortear();
    }
  }

  /** Borra los grupos actuales (si hay) y reparte al azar todos los equipos inscritos, sin repetir ninguno. */
  protected sortear(): void {
    const plan = this.plan();
    if (plan.error || this.trabajando()) {
      return;
    }
    this.confirmandoSorteo.set(false);
    const equipos = barajar(this.inscritos().map((e) => e.idEquipo));
    const actuales = this.grupos();
    this.comenzar('Preparando el sorteo…');

    this.borrarGrupos(actuales)
      .pipe(
        concatMap(() => {
          this.progreso.set('Creando grupos…');
          return from(plan.tamanos.map((_, i) => LETRAS[i])).pipe(
            concatMap((letra) => this.organizador.crearGrupo({ fase: FASE, letra, idTorneo: this.torneo().idTorneo })),
            toArray(),
          );
        }),
        concatMap((creados: Grupo[]) => {
          const pares: [number, number][] = [];
          let k = 0;
          creados.forEach((g, i) => {
            for (let n = 0; n < plan.tamanos[i]; n++) {
              pares.push([g.idGrupo, equipos[k++]]);
            }
          });
          let hechos = 0;
          return from(pares).pipe(
            mergeMap(([idGrupo, idEquipo]) => {
              return this.organizador.asignarEquipoAGrupo(idGrupo, idEquipo).pipe(
                concatMap((r) => {
                  this.progreso.set(`Asignando equipos… ${++hechos} de ${pares.length}`);
                  return [r];
                }),
              );
            }, PARALELO),
            toArray(),
          );
        }),
      )
      .subscribe({
        next: () => this.terminar({ tipo: 'ok', texto: `Sorteo listo: ${plan.texto}.` }),
        error: (err: unknown) => this.terminar({ tipo: 'error', texto: mensajeDeError(err) }),
      });
  }

  /** Quita los equipos y luego elimina los grupos dados. */
  private borrarGrupos(grupos: GrupoConEquipos[]): Observable<unknown> {
    const quitar: [number, number][] = grupos.flatMap((g) => g.equipos.map((e): [number, number] => [g.idGrupo, e.idEquipo]));
    return from(quitar).pipe(
      mergeMap(([idGrupo, idEquipo]) => this.organizador.quitarEquipoDeGrupo(idGrupo, idEquipo), PARALELO),
      toArray(),
      concatMap(() => from(grupos).pipe(mergeMap((g) => this.organizador.eliminarGrupo(g.idGrupo), PARALELO), toArray())),
    );
  }

  protected borrarTodo(): void {
    if (this.trabajando()) {
      return;
    }
    this.confirmandoBorrarTodo.set(false);
    this.comenzar('Borrando grupos…');
    this.borrarGrupos(this.grupos()).subscribe({
      next: () => this.terminar({ tipo: 'ok', texto: 'Se borraron todos los grupos.' }),
      error: (err: unknown) => this.terminar({ tipo: 'error', texto: mensajeDeError(err) }),
    });
  }

  // ---- Manual ----

  protected agregarGrupo(): void {
    const letra = this.letraNueva();
    if (!letra || this.trabajando()) {
      return;
    }
    this.ejecutar(
      this.organizador.crearGrupo({ fase: FASE, letra, idTorneo: this.torneo().idTorneo }),
      `Grupo ${letra} creado.`,
    );
  }

  protected elegirEquipo(idGrupo: number, valor: string): void {
    this.elegidoPorGrupo.update((m) => ({ ...m, [idGrupo]: Number(valor) }));
  }

  protected equipoElegido(idGrupo: number): number {
    const elegido = this.elegidoPorGrupo()[idGrupo];
    const libres = this.sinGrupo();
    return libres.some((e) => e.idEquipo === elegido) ? elegido : (libres[0]?.idEquipo ?? 0);
  }

  protected asignar(g: GrupoConEquipos): void {
    const idEquipo = this.equipoElegido(g.idGrupo);
    if (!idEquipo || this.trabajando()) {
      return;
    }
    const nombre = this.inscritos().find((e) => e.idEquipo === idEquipo)?.nombreEquipo ?? 'El equipo';
    this.ejecutar(this.organizador.asignarEquipoAGrupo(g.idGrupo, idEquipo), `${nombre} quedó en el grupo ${g.letra}.`);
  }

  protected quitar(g: GrupoConEquipos, e: EquipoDeGrupo): void {
    if (this.trabajando()) {
      return;
    }
    this.ejecutar(this.organizador.quitarEquipoDeGrupo(g.idGrupo, e.idEquipo), `${e.nombreEquipo} salió del grupo ${g.letra}.`);
  }

  protected eliminar(g: GrupoConEquipos): void {
    if (this.trabajando()) {
      return;
    }
    this.confirmandoEliminar.set(null);
    this.ejecutar(this.organizador.eliminarGrupo(g.idGrupo), `Grupo ${g.letra} eliminado.`);
  }

  // ---- comunes ----

  private ejecutar(accion: Observable<unknown>, textoOk: string): void {
    this.comenzar(null);
    accion.subscribe({
      next: () => this.terminar({ tipo: 'ok', texto: textoOk }),
      error: (err: unknown) => this.terminar({ tipo: 'error', texto: mensajeDeError(err) }),
    });
  }

  private comenzar(progreso: string | null): void {
    this.trabajando.set(true);
    this.progreso.set(progreso);
    this.mensaje.set(null);
  }

  /** Vuelve a pedir los grupos al backend para mostrar siempre lo que realmente quedo guardado. */
  private terminar(m: Mensaje): void {
    this.cargarGrupos(() => {
      this.trabajando.set(false);
      this.progreso.set(null);
      this.mensaje.set(m);
    });
  }
}
