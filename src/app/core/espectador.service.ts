import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from './config';
import { EventoPartido, PerfilRequest, Seguimiento, Usuario } from './models';

/** Llamadas del usuario con sesion: seguir torneos y editar su perfil. */
@Injectable({ providedIn: 'root' })
export class EspectadorService {
  private readonly http = inject(HttpClient);

  seguimientos(idUsuario: number): Observable<Seguimiento[]> {
    return this.http.get<Seguimiento[]>(`${API_URL}/usuarios/${idUsuario}/seguimientos`);
  }

  seguir(idUsuario: number, idTorneo: number, avisos = true): Observable<Seguimiento> {
    const params = new HttpParams().set('notificacion', avisos ? 'S' : 'N');
    return this.http.post<Seguimiento>(`${API_URL}/usuarios/${idUsuario}/seguimientos/${idTorneo}`, null, { params });
  }

  dejarDeSeguir(idUsuario: number, idTorneo: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/usuarios/${idUsuario}/seguimientos/${idTorneo}`);
  }

  cambiarAvisos(idUsuario: number, idTorneo: number, avisos: boolean): Observable<Seguimiento> {
    const params = new HttpParams().set('valor', avisos ? 'S' : 'N');
    return this.http.patch<Seguimiento>(
      `${API_URL}/usuarios/${idUsuario}/seguimientos/${idTorneo}/notificacion`,
      null,
      { params },
    );
  }

  perfil(idUsuario: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${API_URL}/usuarios/${idUsuario}`);
  }

  actualizarPerfil(idUsuario: number, datos: PerfilRequest): Observable<Usuario> {
    return this.http.put<Usuario>(`${API_URL}/usuarios/${idUsuario}`, datos);
  }

  /** Eventos (goles, tarjetas...) de un partido: consulta publica. */
  eventos(idPartido: number): Observable<EventoPartido[]> {
    return this.http.get<EventoPartido[]>(`${API_URL}/partidos/${idPartido}/eventos`);
  }
}
