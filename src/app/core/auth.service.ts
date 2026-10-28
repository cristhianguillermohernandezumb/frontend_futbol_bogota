import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_URL } from './config';
import { LoginRequest, LoginResponse, RegistroRequest, Rol, Usuario } from './models';

const CLAVE_SESION = 'futbol_bogota_sesion';

interface Sesion {
  token: string;
  usuario: Usuario;
  /** Momento (en milisegundos) en que el token deja de servir. */
  expiraEn: number;
}

/** Lee la sesion guardada; si no existe, esta danada o ya expiro, la descarta. */
function leerSesion(): Sesion | null {
  try {
    const texto = localStorage.getItem(CLAVE_SESION);
    if (!texto) {
      return null;
    }
    const sesion = JSON.parse(texto) as Sesion;
    if (!sesion.token || !sesion.usuario || sesion.expiraEn <= Date.now()) {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
    return sesion;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sesion = signal<Sesion | null>(leerSesion());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly token = computed(() => this.sesion()?.token ?? null);
  readonly autenticado = computed(() => this.sesion() !== null);
  readonly rol = computed(() => this.usuario()?.rol ?? null);

  login(credenciales: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, credenciales).pipe(
      tap((respuesta) =>
        this.guardar({
          token: respuesta.token,
          usuario: respuesta.usuario,
          expiraEn: Date.now() + respuesta.expiraEnMinutos * 60_000,
        }),
      ),
    );
  }

  registrar(datos: RegistroRequest): Observable<Usuario> {
    return this.http.post<Usuario>(`${API_URL}/usuarios`, datos);
  }

  /** Cierra la sesion. Con motivo "expirada" lleva al login avisando que se venció. */
  cerrarSesion(motivo?: 'expirada'): void {
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Sin almacenamiento disponible: la sesion solo vivia en memoria.
    }
    this.sesion.set(null);
    if (motivo) {
      void this.router.navigate(['/login'], { queryParams: { motivo } });
    } else {
      void this.router.navigateByUrl('/');
    }
  }

  /** Refresca los datos del usuario guardados en la sesion (por ejemplo, tras editar el perfil). */
  actualizarUsuario(usuario: Usuario): void {
    const actual = this.sesion();
    if (actual) {
      this.guardar({ ...actual, usuario });
    }
  }

  tieneRol(...roles: Rol[]): boolean {
    const actual = this.rol();
    return actual !== null && roles.includes(actual);
  }

  private guardar(sesion: Sesion): void {
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch {
      // Si el navegador no deja guardar, la sesion dura mientras la pestaña siga abierta.
    }
    this.sesion.set(sesion);
  }
}
