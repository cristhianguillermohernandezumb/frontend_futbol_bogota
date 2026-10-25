import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap, tap } from 'rxjs';

import { mensajeDeError } from '../../../../core/api-error';
import { Equipo, EquipoInscrito, Torneo } from '../../../../core/models';
import { OrganizadorService } from '../../../../core/organizador.service';
import { TorneoService } from '../../../../core/torneo.service';

/** El backend exige un escudo; si no se sube imagen se envia un byte vacio de relleno. */
const ESCUDO_VACIO = 'AA==';
const MAX_ESCUDO_BYTES = 200 * 1024;

interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

@Component({
  selector: 'app-equipos-gestion',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './equipos-gestion.html',
  styleUrl: './equipos-gestion.css',
})
export class EquiposGestion implements OnInit {
  readonly torneo = input.required<Torneo>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly organizador = inject(OrganizadorService);
  private readonly torneoService = inject(TorneoService);

  protected readonly inscritos = signal<EquipoInscrito[]>([]);
  protected readonly todos = signal<Equipo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensaje = signal<Mensaje | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly retirando = signal<number | null>(null);

  /** Equipos que existen pero todavia no estan en este torneo. */
  protected readonly disponibles = computed(() => {
    const ids = new Set(this.inscritos().map((i) => i.idEquipo));
    return this.todos().filter((e) => !ids.has(e.idEquipo));
  });

  protected readonly abiertas = computed(() => this.torneo().estado === 'INSCRIPCION');
  protected readonly lleno = computed(() => this.inscritos().length >= this.torneo().maxEquipos);

  protected readonly existente = this.fb.control(0);
  protected readonly mostrarNuevo = signal(false);
  protected readonly intento = signal(false);
  protected readonly escudo = signal<string>(ESCUDO_VACIO);
  protected readonly escudoNombre = signal<string | null>(null);
  protected readonly errorEscudo = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    fechaFundacion: ['', [Validators.required]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    telefonoEquipo: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]],
  });

  protected readonly hoy = new Date().toISOString().slice(0, 10);

  /** Equipo recien creado cuyo intento de inscripcion fallo (para reintentar sin duplicarlo). */
  private creado: { nombre: string; id: number } | null = null;

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
        this.inscritos.set(lista);
        listo();
      },
      error: falla,
    });
    this.organizador.equipos().subscribe({
      next: (lista) => {
        this.todos.set(lista);
        listo();
      },
      error: falla,
    });
  }

  protected invalido(campo: keyof typeof this.form.controls): boolean {
    return this.intento() && this.form.controls[campo].invalid;
  }

  protected inscribirExistente(): void {
    const id = Number(this.existente.value);
    if (!id) {
      this.mensaje.set({ tipo: 'error', texto: 'Elige un equipo de la lista.' });
      return;
    }
    this.ejecutar(this.organizador.inscribir(this.torneo().idTorneo, id), 'Equipo inscrito.', () =>
      this.existente.setValue(0),
    );
  }

  protected crearEInscribir(): void {
    this.intento.set(true);
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      fechaFundacion: v.fechaFundacion,
      correo: v.correo.trim(),
      telefonoEquipo: Number(v.telefonoEquipo),
      escudo: this.escudo(),
    };
    // Si el equipo ya se creo en un intento anterior (y solo fallo la inscripcion), no se vuelve a crear.
    const creacion: Observable<{ idEquipo: number }> =
      this.creado?.nombre === datos.nombre
        ? of({ idEquipo: this.creado.id })
        : this.organizador.crearEquipo(datos).pipe(tap((e) => (this.creado = { nombre: datos.nombre, id: e.idEquipo })));
    this.ejecutar(
      creacion.pipe(switchMap((e) => this.organizador.inscribir(this.torneo().idTorneo, e.idEquipo))),
      'Equipo creado e inscrito.',
      () => {
        this.creado = null;
        this.form.reset();
        this.intento.set(false);
        this.escudo.set(ESCUDO_VACIO);
        this.escudoNombre.set(null);
        this.mostrarNuevo.set(false);
      },
    );
  }

  protected pagar(e: EquipoInscrito): void {
    this.ejecutar(this.organizador.marcarPagada(e.idTorneo, e.idEquipo), `Pago de ${e.nombreEquipo} registrado.`);
  }

  protected retirar(e: EquipoInscrito): void {
    this.retirando.set(null);
    this.ejecutar(this.organizador.retirar(e.idTorneo, e.idEquipo), `${e.nombreEquipo} fue retirado del torneo.`);
  }

  protected elegirEscudo(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    this.errorEscudo.set(null);
    if (!archivo) {
      this.escudo.set(ESCUDO_VACIO);
      this.escudoNombre.set(null);
      return;
    }
    if (!archivo.type.startsWith('image/') || archivo.size > MAX_ESCUDO_BYTES) {
      this.errorEscudo.set('Elige una imagen de máximo 200 KB.');
      (evento.target as HTMLInputElement).value = '';
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      // dataURL: "data:image/png;base64,XXXX" -> solo se envia lo que va despues de la coma
      this.escudo.set((lector.result as string).split(',')[1] ?? ESCUDO_VACIO);
      this.escudoNombre.set(archivo.name);
    };
    lector.readAsDataURL(archivo);
  }

  /** Ejecuta una accion contra el backend, avisa el resultado y recarga las listas. */
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
