import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { Arbitro, ArbitroAsignado, EstadoPartido, RolArbitro, TipoDocumento } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

const ROLES: { valor: RolArbitro; texto: string }[] = [
  { valor: 'CENTRAL', texto: 'Central' },
  { valor: 'ASISTENTE_1', texto: 'Asistente 1' },
  { valor: 'ASISTENTE_2', texto: 'Asistente 2' },
  { valor: 'CUARTO', texto: 'Cuarto árbitro' },
  { valor: 'VAR', texto: 'VAR' },
];

@Component({
  selector: 'app-arbitros-partido',
  imports: [ReactiveFormsModule],
  templateUrl: './arbitros-partido.html',
  styleUrl: './arbitros-partido.css',
})
export class ArbitrosPartido implements OnInit {
  readonly idPartido = input.required<number>();
  readonly estadoPartido = input.required<EstadoPartido>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);

  protected readonly asignados = signal<ArbitroAsignado[]>([]);
  protected readonly catalogo = signal<Arbitro[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly mostrarNuevo = signal(false);
  protected readonly intento = signal(false);
  protected readonly intentoAsignar = signal(false);

  /** Solo se cambian los arbitros de un partido PROGRAMADO o APLAZADO (regla del backend). */
  protected readonly editable = computed(() => ['PROGRAMADO', 'APLAZADO'].includes(this.estadoPartido()));

  protected readonly disponibles = computed(() => {
    const usados = new Set(this.asignados().map((a) => a.idArbitro));
    return this.catalogo().filter((a) => a.estado === 'ACTIVO' && !usados.has(a.idArbitro));
  });

  protected readonly rolesLibres = computed(() => {
    const usados = new Set<string>(this.asignados().map((a) => a.rol));
    return ROLES.filter((r) => !usados.has(r.valor));
  });

  protected readonly tieneCentral = computed(() => this.asignados().some((a) => a.rol === 'CENTRAL'));

  protected readonly tipos: TipoDocumento[] = ['CC', 'CE', 'TI', 'PAS'];
  protected readonly hoy = new Date().toISOString().slice(0, 10);

  protected readonly formAsignar = this.fb.group({
    idArbitro: [0, [Validators.min(1)]],
    rol: ['CENTRAL' as RolArbitro, [Validators.required]],
  });

  protected readonly formNuevo = this.fb.group({
    tipoDocumento: ['CC' as TipoDocumento, [Validators.required]],
    documento: ['', [Validators.required, Validators.maxLength(50)]],
    primerNombre: ['', [Validators.required, Validators.maxLength(50)]],
    segundoNombre: ['', [Validators.maxLength(50)]],
    primerApellido: ['', [Validators.required, Validators.maxLength(50)]],
    segundoApellido: ['', [Validators.maxLength(50)]],
    fechaNacimiento: ['', [Validators.required]],
    numeroLicencia: [null as number | null, [Validators.required, Validators.min(1)]],
    nacionalidad: ['Colombiana', [Validators.required, Validators.maxLength(50)]],
    correo: ['', [Validators.email, Validators.maxLength(100)]],
    telefono: ['', [Validators.pattern(/^\d{7,20}$/)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected etiquetaRol(rol: RolArbitro): string {
    return ROLES.find((r) => r.valor === rol)?.texto ?? rol;
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    let pendientes = 2;
    const listo = () => {
      if (--pendientes === 0) {
        this.cargando.set(false);
        this.ajustarRol();
      }
    };
    const falla = (err: unknown) => {
      this.errorCarga.set(mensajeDeError(err));
      listo();
    };
    this.organizador.arbitrosDePartido(this.idPartido()).subscribe({
      next: (l) => {
        this.asignados.set(l);
        listo();
      },
      error: falla,
    });
    this.organizador.arbitros().subscribe({
      next: (l) => {
        this.catalogo.set(l);
        listo();
      },
      error: falla,
    });
  }

  /** Deja elegido un rol que todavia este libre (el primero de la lista: Central, Asistente 1…). */
  private ajustarRol(): void {
    const libres = this.rolesLibres();
    if (libres.length > 0 && !libres.some((r) => r.valor === this.formAsignar.controls.rol.value)) {
      this.formAsignar.controls.rol.setValue(libres[0].valor);
    }
  }

  protected invalidoN(campo: keyof typeof this.formNuevo.controls): boolean {
    return this.intento() && this.formNuevo.controls[campo].invalid;
  }

  protected asignar(): void {
    this.intentoAsignar.set(true);
    if (this.formAsignar.invalid) {
      return;
    }
    const v = this.formAsignar.getRawValue();
    this.ejecutar(
      this.organizador.asignarArbitro(this.idPartido(), Number(v.idArbitro), v.rol),
      'Árbitro asignado.',
      () => {
        this.formAsignar.controls.idArbitro.setValue(0);
        this.intentoAsignar.set(false);
      },
    );
  }

  protected quitar(a: ArbitroAsignado): void {
    this.ejecutar(this.organizador.quitarArbitro(a.idPartido, a.idArbitro), `${a.nombreArbitro} fue quitado del partido.`);
  }

  protected crearArbitro(): void {
    this.intento.set(true);
    if (this.formNuevo.invalid) {
      return;
    }
    const v = this.formNuevo.getRawValue();
    this.trabajando.set(true);
    this.mensaje.set(null);
    this.organizador
      .crearArbitro({
        documento: v.documento.trim(),
        tipoDocumento: v.tipoDocumento,
        primerNombre: v.primerNombre.trim(),
        segundoNombre: v.segundoNombre.trim(),
        primerApellido: v.primerApellido.trim(),
        segundoApellido: v.segundoApellido.trim(),
        fechaNacimiento: v.fechaNacimiento,
        numeroLicencia: Number(v.numeroLicencia),
        nacionalidad: v.nacionalidad.trim(),
        estado: 'ACTIVO',
        correos: v.correo.trim() ? [v.correo.trim()] : [],
        telefonos: v.telefono.trim() ? [v.telefono.trim()] : [],
      })
      .subscribe({
        next: (nuevo) => {
          this.trabajando.set(false);
          this.mensaje.set({ tipo: 'ok', texto: 'Árbitro creado. Elige su rol y asígnalo al partido.' });
          this.formNuevo.reset({ tipoDocumento: 'CC', nacionalidad: 'Colombiana' });
          this.intento.set(false);
          this.mostrarNuevo.set(false);
          // Se deja elegido el arbitro recien creado para asignarlo con un clic.
          this.organizador.arbitros().subscribe({
            next: (l) => {
              this.catalogo.set(l);
              this.formAsignar.controls.idArbitro.setValue(nuevo.idArbitro);
            },
          });
        },
        error: (err: unknown) => {
          this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
          this.trabajando.set(false);
        },
      });
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
      },
    });
  }
}
