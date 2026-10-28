import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '../../core/admin.service';
import { mensajeDeError } from '../../core/api-error';
import { AuditoriaRegistro } from '../../core/models';

const TAMANO_PAGINA = 50;

@Component({
  selector: 'app-auditoria-admin',
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './auditoria-admin.html',
  styleUrl: './auditoria-admin.css',
})
export class AuditoriaAdmin implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly registros = signal<AuditoriaRegistro[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly filtroUsuario = signal('');
  protected readonly filtroAccion = signal('');
  protected readonly filtroEntidad = signal('');
  protected readonly limite = signal(TAMANO_PAGINA);

  protected readonly usuarios = computed(() => {
    const mapa = new Map<number, string>();
    this.registros().forEach((r) => mapa.set(r.idUsuario, r.nombreUsuario));
    return [...mapa].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });
  protected readonly acciones = computed(() => [...new Set(this.registros().map((r) => r.accion))].sort());
  protected readonly entidades = computed(() => [...new Set(this.registros().map((r) => r.entidad))].sort());

  protected readonly filtrados = computed(() =>
    this.registros().filter(
      (r) =>
        (!this.filtroUsuario() || String(r.idUsuario) === this.filtroUsuario()) &&
        (!this.filtroAccion() || r.accion === this.filtroAccion()) &&
        (!this.filtroEntidad() || r.entidad === this.filtroEntidad()),
    ),
  );
  protected readonly visibles = computed(() => this.filtrados().slice(0, this.limite()));

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.admin.auditoria().subscribe({
      next: (lista) => {
        this.registros.set(lista);
        this.limite.set(TAMANO_PAGINA);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeDeError(err));
        this.cargando.set(false);
      },
    });
  }

  /** Al cambiar un filtro se vuelve a la primera pagina. */
  protected filtrar(senal: { set(valor: string): void }, valor: string): void {
    senal.set(valor);
    this.limite.set(TAMANO_PAGINA);
  }

  protected masResultados(): void {
    this.limite.update((n) => n + TAMANO_PAGINA);
  }

  protected claseAccion(accion: string): string {
    const a = accion.toUpperCase();
    if (a.startsWith('ELIM') || a.startsWith('DELETE') || a.startsWith('BORR')) {
      return 'accion-elim';
    }
    if (a.startsWith('CRE') || a.startsWith('INSERT') || a.startsWith('POST')) {
      return 'accion-crear';
    }
    return 'accion-otra';
  }
}
