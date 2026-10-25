import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap, tap } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import {
  EquipoInscrito,
  Jugador,
  JugadorInscrito,
  JugadorRequest,
  PiernaHabil,
  PosicionJugador,
  TipoDocumento,
  Torneo,
} from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

@Component({
  selector: 'app-jugadores-gestion',
  imports: [ReactiveFormsModule],
  templateUrl: './jugadores-gestion.html',
  styleUrl: './jugadores-gestion.css',
})
export class JugadoresGestion implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly equipos = signal<EquipoInscrito[]>([]);
  protected readonly equipoId = signal(0);
  protected readonly plantilla = signal<JugadorInscrito[]>([]);
  protected readonly todos = signal<Jugador[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoPlantilla = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly retirando = signal<number | null>(null);

  protected readonly puedeModificar = computed(() => this.torneo().estado !== 'FINALIZADO');
  protected readonly plantillaOrdenada = computed(() =>
    [...this.plantilla()].sort((a, b) => a.numeroCamiseta - b.numeroCamiseta),
  );

  protected readonly modo = signal<'cerrado' | 'existente' | 'nuevo'>('cerrado');
  protected readonly intento = signal(false);

  protected readonly tipos: TipoDocumento[] = ['CC', 'CE', 'TI', 'PAS'];
  protected readonly piernas: { valor: PiernaHabil; texto: string }[] = [
    { valor: 'DERECHA', texto: 'Derecha' },
    { valor: 'IZQUIERDA', texto: 'Izquierda' },
    { valor: 'AMBIDIESTRO', texto: 'Ambidiestro' },
  ];
  protected readonly posiciones: { valor: PosicionJugador; texto: string }[] = [
    { valor: 'PORTERO', texto: 'Portero' },
    { valor: 'DEFENSA', texto: 'Defensa' },
    { valor: 'VOLANTE', texto: 'Volante' },
    { valor: 'DELANTERO', texto: 'Delantero' },
  ];
  protected readonly hoy = new Date().toISOString().slice(0, 10);

  protected readonly formExistente = this.fb.group({
    idJugador: [0, [Validators.min(1)]],
    numeroCamiseta: [null as number | null, [Validators.required, Validators.min(0), Validators.max(99)]],
  });

  protected readonly formNuevo = this.fb.group({
    tipoDocumento: ['CC' as TipoDocumento, [Validators.required]],
    documento: ['', [Validators.required, Validators.maxLength(50)]],
    primerNombre: ['', [Validators.required, Validators.maxLength(50)]],
    segundoNombre: ['', [Validators.maxLength(50)]],
    primerApellido: ['', [Validators.required, Validators.maxLength(50)]],
    segundoApellido: ['', [Validators.maxLength(50)]],
    fechaNacimiento: ['', [Validators.required]],
    estatura: [null as number | null, [Validators.required, Validators.min(100), Validators.max(250)]],
    peso: [null as number | null, [Validators.required, Validators.min(30), Validators.max(250)]],
    piernaHabil: ['DERECHA' as PiernaHabil, [Validators.required]],
    nacionalidad: ['Colombiana', [Validators.required, Validators.maxLength(50)]],
    posicion: ['DELANTERO' as PosicionJugador, [Validators.required]],
    correo: ['', [Validators.email, Validators.maxLength(100)]],
    telefono: ['', [Validators.pattern(/^\d{7,20}$/)]],
    numeroCamiseta: [null as number | null, [Validators.required, Validators.min(0), Validators.max(99)]],
  });

  /** Jugador recien creado cuyo intento de inscripcion fallo (para reintentar sin duplicarlo). */
  private creado: { clave: string; id: number } | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    let pendientes = 2;
    const listo = () => {
      if (--pendientes === 0) {
        this.cargando.set(false);
      }
    };
    const falla = (err: unknown) => {
      this.errorCarga.set(mensajeDeError(err));
      listo();
    };
    this.torneoService.equipos(this.torneo().idTorneo).subscribe({
      next: (lista) => {
        this.equipos.set(lista);
        if (!lista.some((e) => e.idEquipo === this.equipoId())) {
          this.equipoId.set(lista[0]?.idEquipo ?? 0);
        }
        this.cargarPlantilla();
        listo();
      },
      error: falla,
    });
    this.organizador.jugadores().subscribe({
      next: (lista) => {
        this.todos.set(lista);
        listo();
      },
      error: falla,
    });
  }

  protected elegirEquipo(valor: string): void {
    this.equipoId.set(Number(valor));
    this.retirando.set(null);
    this.cargarPlantilla();
  }

  protected cargarPlantilla(): void {
    const idEquipo = this.equipoId();
    if (!idEquipo) {
      this.plantilla.set([]);
      return;
    }
    this.cargandoPlantilla.set(true);
    this.organizador.jugadoresDeEquipo(this.torneo().idTorneo, idEquipo).subscribe({
      next: (lista) => {
        if (idEquipo === this.equipoId()) {
          this.plantilla.set(lista);
          this.cargandoPlantilla.set(false);
        }
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.cargandoPlantilla.set(false);
      },
    });
  }

  protected invalidoE(campo: keyof typeof this.formExistente.controls): boolean {
    return this.intento() && this.formExistente.controls[campo].invalid;
  }

  protected invalidoN(campo: keyof typeof this.formNuevo.controls): boolean {
    return this.intento() && this.formNuevo.controls[campo].invalid;
  }

  protected abrir(modo: 'existente' | 'nuevo'): void {
    this.intento.set(false);
    this.modo.set(modo);
  }

  protected inscribirExistente(): void {
    this.intento.set(true);
    if (this.formExistente.invalid) {
      return;
    }
    const v = this.formExistente.getRawValue();
    this.ejecutar(
      this.organizador.inscribirJugador(
        this.torneo().idTorneo,
        this.equipoId(),
        Number(v.idJugador),
        Number(v.numeroCamiseta),
      ),
      'Jugador inscrito.',
      () => {
        this.formExistente.reset({ idJugador: 0, numeroCamiseta: null });
        this.intento.set(false);
        this.modo.set('cerrado');
      },
    );
  }

  protected crearEInscribir(): void {
    this.intento.set(true);
    if (this.formNuevo.invalid) {
      return;
    }
    const v = this.formNuevo.getRawValue();
    const datos: JugadorRequest = {
      documento: v.documento.trim(),
      tipoDocumento: v.tipoDocumento,
      primerNombre: v.primerNombre.trim(),
      segundoNombre: v.segundoNombre.trim(),
      primerApellido: v.primerApellido.trim(),
      segundoApellido: v.segundoApellido.trim(),
      fechaNacimiento: v.fechaNacimiento,
      estatura: Number(v.estatura),
      peso: Number(v.peso),
      piernaHabil: v.piernaHabil,
      nacionalidad: v.nacionalidad.trim(),
      estado: 'ACTIVO',
      posicion: v.posicion,
      correos: v.correo.trim() ? [v.correo.trim()] : [],
      telefonos: v.telefono.trim() ? [v.telefono.trim()] : [],
    };
    // Si el jugador ya se creo en un intento anterior (y solo fallo la inscripcion), no se vuelve a crear.
    const clave = `${datos.tipoDocumento}-${datos.documento}`;
    const creacion: Observable<{ idJugador: number }> =
      this.creado?.clave === clave
        ? of({ idJugador: this.creado.id })
        : this.organizador.crearJugador(datos).pipe(tap((j) => (this.creado = { clave, id: j.idJugador })));
    this.ejecutar(
      creacion.pipe(
        switchMap((j) =>
          this.organizador.inscribirJugador(this.torneo().idTorneo, this.equipoId(), j.idJugador, Number(v.numeroCamiseta)),
        ),
      ),
      'Jugador creado e inscrito.',
      () => {
        this.creado = null;
        this.formNuevo.reset({
          tipoDocumento: 'CC',
          piernaHabil: 'DERECHA',
          nacionalidad: 'Colombiana',
          posicion: 'DELANTERO',
        });
        this.intento.set(false);
        this.modo.set('cerrado');
      },
    );
  }

  protected retirar(j: JugadorInscrito): void {
    this.retirando.set(null);
    this.ejecutar(
      this.organizador.retirarJugador(j.idTorneo, j.idEquipo, j.idJugador),
      `${j.nombreJugador} fue retirado del equipo.`,
    );
  }

  protected nombreEquipo(): string {
    return this.equipos().find((e) => e.idEquipo === this.equipoId())?.nombreEquipo ?? '';
  }

  private ejecutar(accion: Observable<unknown>, exito: string, alTerminar?: () => void): void {
    this.trabajando.set(true);
    this.mensaje.set(null);
    accion.subscribe({
      next: () => {
        this.mensaje.set({ tipo: 'ok', texto: exito });
        this.trabajando.set(false);
        alTerminar?.();
        this.cargar();
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.trabajando.set(false);
        // Si el jugador se creo pero fallo la inscripcion (por ejemplo, camiseta repetida), queda disponible en "existente".
        this.cargar();
      },
    });
  }
}
