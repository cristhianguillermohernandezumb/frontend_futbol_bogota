import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { Entrenador, EntrenadorRequest, EquipoInscrito, TipoDocumento, Torneo } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

@Component({
  selector: 'app-entrenadores-gestion',
  imports: [ReactiveFormsModule],
  templateUrl: './entrenadores-gestion.html',
  styleUrl: './entrenadores-gestion.css',
})
export class EntrenadoresGestion implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly equipos = signal<EquipoInscrito[]>([]);
  protected readonly equipoId = signal(0);
  protected readonly entrenadores = signal<Entrenador[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoLista = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly quitando = signal<number | null>(null);
  protected readonly abierto = signal(false);
  protected readonly intento = signal(false);

  protected readonly puedeModificar = computed(() => this.torneo().estado !== 'FINALIZADO');
  protected readonly tipos: TipoDocumento[] = ['CC', 'CE', 'TI', 'PAS'];
  protected readonly hoy = new Date().toISOString().slice(0, 10);

  protected readonly form = this.fb.group({
    tipoDocumento: ['CC' as TipoDocumento, [Validators.required]],
    documento: ['', [Validators.required, Validators.maxLength(50)]],
    primerNombre: ['', [Validators.required, Validators.maxLength(50)]],
    segundoNombre: ['', [Validators.maxLength(50)]],
    primerApellido: ['', [Validators.required, Validators.maxLength(50)]],
    segundoApellido: ['', [Validators.maxLength(50)]],
    fechaNacimiento: ['', [Validators.required]],
    aniosExperiencia: [null as number | null, [Validators.required, Validators.min(0), Validators.max(70)]],
    nacionalidad: ['Colombiana', [Validators.required, Validators.maxLength(50)]],
    correo: ['', [Validators.email, Validators.maxLength(100)]],
    telefono: ['', [Validators.pattern(/^\d{7,20}$/)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.torneoService.equipos(this.torneo().idTorneo).subscribe({
      next: (lista) => {
        this.equipos.set(lista);
        if (!lista.some((e) => e.idEquipo === this.equipoId())) {
          this.equipoId.set(lista[0]?.idEquipo ?? 0);
        }
        this.cargando.set(false);
        this.cargarLista();
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected elegirEquipo(valor: string): void {
    this.equipoId.set(Number(valor));
    this.quitando.set(null);
    this.mensaje.set(null);
    this.cargarLista();
  }

  protected cargarLista(): void {
    const idEquipo = this.equipoId();
    if (!idEquipo) {
      this.entrenadores.set([]);
      return;
    }
    this.cargandoLista.set(true);
    this.organizador.entrenadoresDeEquipo(idEquipo).subscribe({
      next: (lista) => {
        if (idEquipo === this.equipoId()) {
          this.entrenadores.set(lista);
          this.cargandoLista.set(false);
        }
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.cargandoLista.set(false);
      },
    });
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected abrir(): void {
    this.intento.set(false);
    this.abierto.set(true);
  }

  protected nombreEquipo(): string {
    return this.equipos().find((e) => e.idEquipo === this.equipoId())?.nombreEquipo ?? '';
  }

  protected nombre(e: Entrenador): string {
    return [e.primerNombre, e.segundoNombre, e.primerApellido, e.segundoApellido].filter(Boolean).join(' ');
  }

  protected inscribir(): void {
    this.intento.set(true);
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const datos: EntrenadorRequest = {
      documento: v.documento.trim(),
      tipoDocumento: v.tipoDocumento,
      primerNombre: v.primerNombre.trim(),
      segundoNombre: v.segundoNombre.trim(),
      primerApellido: v.primerApellido.trim(),
      segundoApellido: v.segundoApellido.trim(),
      fechaNacimiento: v.fechaNacimiento,
      aniosExperiencia: Number(v.aniosExperiencia),
      nacionalidad: v.nacionalidad.trim(),
      idEquipo: this.equipoId(),
      correos: v.correo.trim() ? [v.correo.trim()] : [],
      telefonos: v.telefono.trim() ? [v.telefono.trim()] : [],
    };
    this.ejecutar(this.organizador.crearEntrenador(datos), `Entrenador inscrito en ${this.nombreEquipo()}.`, () => {
      this.form.reset({ tipoDocumento: 'CC', nacionalidad: 'Colombiana' });
      this.intento.set(false);
      this.abierto.set(false);
    });
  }

  protected quitar(e: Entrenador): void {
    this.quitando.set(null);
    this.ejecutar(this.organizador.eliminarEntrenador(e.idEntrenador), `${this.nombre(e)} ya no es entrenador de este equipo.`);
  }

  private ejecutar(accion: Observable<unknown>, exito: string, alTerminar?: () => void): void {
    this.trabajando.set(true);
    this.mensaje.set(null);
    accion.subscribe({
      next: () => {
        this.mensaje.set({ tipo: 'ok', texto: exito });
        this.trabajando.set(false);
        alTerminar?.();
        this.cargarLista();
      },
      error: (err: unknown) => {
        this.mensaje.set({ tipo: 'error', texto: mensajeDeError(err) });
        this.trabajando.set(false);
      },
    });
  }
}
