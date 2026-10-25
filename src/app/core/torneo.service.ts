import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from './config';
import { EstadoTorneo, Torneo } from './models';

@Injectable({ providedIn: 'root' })
export class TorneoService {
  private readonly http = inject(HttpClient);

  /** Lista los torneos; con estado, solo los de ese estado. Es una consulta publica. */
  listar(estado: EstadoTorneo | null = null): Observable<Torneo[]> {
    const params = estado ? new HttpParams().set('estado', estado) : undefined;
    return this.http.get<Torneo[]>(`${API_URL}/torneos`, { params });
  }
}
