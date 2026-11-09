import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap, tap } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import {
  EquipoInscrito,
  EstadoJugador,
  Jugador,
  JugadorInscrito,
  JugadorRequest,
  PiernaHabil,
  PosicionJugador,
  TipoDocumento,
  Torneo,
} from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { CorreosMultiples, correoValido } from '../../../../shared/correos-multiples/correos-multiples';
import { TelefonosMultiples, telefonoValido } from '../../../../shared/telefonos-multiples/telefonos-multiples';
import { TorneoService } from '../../../../core/torneo.service';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

@Component({
  selector: 'app-jugadores-gestion',
  imports: [ReactiveFormsModule, CorreosMultiples, TelefonosMultiples],
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
  /** Jugador cuyo formulario de correccion esta abierto. */
  protected readonly editando = signal<number | null>(null);
  protected readonly intentoEditar = signal(false);
  protected readonly estados: { valor: EstadoJugador; texto: string }[] = [
    { valor: 'ACTIVO', texto: 'Activo' },
    { valor: 'LESIONADO', texto: 'Lesionado' },
    { valor: 'SUSPENDIDO', texto: 'Suspendido' },
  ];
  /** La camiseta solo se cambia mientras el torneo esta en inscripcion (regla del backend). */
  protected readonly puedeCambiarCamiseta = computed(() => this.torneo().estado === 'INSCRIPCION');

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
    numeroCamiseta: [null as number | null, [Validators.required, Validators.min(0), Validators.max(99)]],
  });

  protected readonly formEditar = this.fb.group({
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
    nacionalidad: ['', [Validators.required, Validators.maxLength(50)]],
    posicion: ['DELANTERO' as PosicionJugador, [Validators.required]],
    estado: ['ACTIVO' as EstadoJugador, [Validators.required]],
    correos: [''],
    telefonos: [''],
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

  protected readonly correosNuevo = signal<string[]>(['']);
  protected readonly telefonosNuevo = signal<string[]>(['']);

  protected crearEInscribir(): void {
    this.intento.set(true);
    if (this.formNuevo.invalid || !this.correosNuevo().every(correoValido) || !this.telefonosNuevo().every(telefonoValido)) {
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
      correos: this.correosNuevo().map((c) => c.trim()).filter(Boolean),
      telefonos: this.telefonosNuevo().map((t) => t.trim()).filter(Boolean),
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
        this.correosNuevo.set(['']);
        this.telefonosNuevo.set(['']);
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

  protected invalidoEditar(campo: keyof typeof this.formEditar.controls): boolean {
    return this.intentoEditar() && this.formEditar.controls[campo].invalid;
  }

  /** Abre (o cierra) el formulario para corregir los datos del jugador, ya cargado con lo que tiene guardado. */
  protected abrirEditar(j: JugadorInscrito): void {
    if (this.editando() === j.idJugador) {
      this.editando.set(null);
      return;
    }
    const a = this.todos().find((x) => x.idJugador === j.idJugador);
    if (!a) {
      this.mensaje.set({ tipo: 'error', texto: 'No se encontraron los datos del jugador. Recarga la página.' });
      return;
    }
    this.mensaje.set(null);
    this.intentoEditar.set(false);
    this.formEditar.reset({
      tipoDocumento: a.tipoDocumento,
      documento: a.documento,
      primerNombre: a.primerNombre,
      segundoNombre: a.segundoNombre,
      primerApellido: a.primerApellido,
      segundoApellido: a.segundoApellido,
      fechaNacimiento: a.fechaNacimiento,
      estatura: a.estatura,
      peso: a.peso,
      piernaHabil: a.piernaHabil,
      nacionalidad: a.nacionalidad,
      posicion: a.posicion,
      estado: a.estado,
      correos: (a.correos ?? []).join(', '),
      telefonos: (a.telefonos ?? []).join(', '),
      numeroCamiseta: j.numeroCamiseta,
    });
    this.editando.set(j.idJugador);
  }

  protected guardarEdicion(j: JugadorInscrito): void {
    this.intentoEditar.set(true);
    if (this.formEditar.invalid) {
      return;
    }
    const v = this.formEditar.getRawValue();
    const lista = (texto: string) =>
      texto
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    const correos = lista(v.correos);
    const telefonos = lista(v.telefonos);
    if (correos.some((c) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c))) {
      this.mensaje.set({ tipo: 'error', texto: 'Revisa los correos: separa varios con coma y escribe direcciones válidas.' });
      return;
    }
    if (telefonos.some((t) => !/^\d{7,20}$/.test(t))) {
      this.mensaje.set({ tipo: 'error', texto: 'Revisa los teléfonos: solo números (7 a 20 dígitos), varios separados por coma.' });
      return;
    }
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
      estado: v.estado,
      posicion: v.posicion,
      correos,
      telefonos,
    };
    const camiseta = Number(v.numeroCamiseta);
    const cambiaCamiseta = this.puedeCambiarCamiseta() && camiseta !== j.numeroCamiseta;
    const guardar = this.organizador.actualizarJugador(j.idJugador, datos);
    this.ejecutar(
      cambiaCamiseta
        ? guardar.pipe(switchMap(() => this.organizador.cambiarCamiseta(j.idTorneo, j.idEquipo, j.idJugador, camiseta)))
        : guardar,
      `Datos de ${datos.primerNombre} ${datos.primerApellido} actualizados.`,
      () => {
        this.editando.set(null);
        this.intentoEditar.set(false);
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

  protected etiquetaPierna(pierna: string): string {
    return pierna ? pierna.charAt(0) + pierna.slice(1).toLowerCase() : '';
  }
}
