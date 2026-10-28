import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from './config';
import { AuditoriaRegistro, Rol, Usuario } from './models';

/** Llamadas que solo puede hacer un ADMIN. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  usuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${API_URL}/usuarios`);
  }

  cambiarRol(idUsuario: number, rol: Rol): Observable<Usuario> {
    const params = new HttpParams().set('valor', rol);
    return this.http.patch<Usuario>(`${API_URL}/usuarios/${idUsuario}/rol`, null, { params });
  }

  activar(idUsuario: number): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API_URL}/usuarios/${idUsuario}/activar`, null);
  }

  desactivar(idUsuario: number): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API_URL}/usuarios/${idUsuario}/desactivar`, null);
  }

  /** Mas recientes primero. */
  auditoria(): Observable<AuditoriaRegistro[]> {
    return this.http.get<AuditoriaRegistro[]>(`${API_URL}/auditoria`);
  }
}
