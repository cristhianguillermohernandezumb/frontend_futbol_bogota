import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { API_URL } from './config';
import {
  EquipoDePartido,
  EquipoInscrito,
  EstadoTorneo,
  Goleador,
  Partido,
  PartidoConEquipos,
  Posicion,
  Torneo,
} from './models';

@Injectable({ providedIn: 'root' })
export class TorneoService {
  private readonly http = inject(HttpClient);

  /** Lista los torneos; con estado, solo los de ese estado. Es una consulta publica. */
  listar(estado: EstadoTorneo | null = null): Observable<Torneo[]> {
    const params = estado ? new HttpParams().set('estado', estado) : undefined;
    return this.http.get<Torneo[]>(`${API_URL}/torneos`, { params });
  }

  obtener(id: number): Observable<Torneo> {
    return this.http.get<Torneo>(`${API_URL}/torneos/${id}`);
  }

  equipos(id: number): Observable<EquipoInscrito[]> {
    return this.http.get<EquipoInscrito[]>(`${API_URL}/torneos/${id}/equipos`);
  }

  posiciones(id: number): Observable<Posicion[]> {
    return this.http.get<Posicion[]>(`${API_URL}/torneos/${id}/posiciones`);
  }

  goleadores(id: number, limite = 10): Observable<Goleador[]> {
    const params = new HttpParams().set('limite', limite);
    return this.http.get<Goleador[]>(`${API_URL}/torneos/${id}/goleadores`, { params });
  }

  /**
   * Partidos del torneo con el nombre de cada equipo. El backend entrega los equipos de un partido
   * por aparte (GET /partidos/{id}/equipos), asi que se piden en paralelo y se unen aqui.
   */
  partidos(id: number): Observable<PartidoConEquipos[]> {
    const params = new HttpParams().set('idTorneo', id);
    return this.http.get<Partido[]>(`${API_URL}/partidos`, { params }).pipe(
      switchMap((partidos) =>
        partidos.length === 0
          ? of([])
          : forkJoin(
              partidos.map((p) =>
                this.http.get<EquipoDePartido[]>(`${API_URL}/partidos/${p.idPartido}/equipos`),
              ),
            ).pipe(
              map((equipos) =>
                partidos.map((p, i): PartidoConEquipos => ({
                  ...p,
                  local: equipos[i].find((e) => e.rol === 'LOCAL')?.nombreEquipo ?? null,
                  visitante: equipos[i].find((e) => e.rol === 'VISITANTE')?.nombreEquipo ?? null,
                  idLocal: equipos[i].find((e) => e.rol === 'LOCAL')?.idEquipo ?? null,
                  idVisitante: equipos[i].find((e) => e.rol === 'VISITANTE')?.idEquipo ?? null,
                })),
              ),
            ),
      ),
    );
  }
}
