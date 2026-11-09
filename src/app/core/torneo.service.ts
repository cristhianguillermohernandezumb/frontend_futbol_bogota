import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { API_URL } from './config';
import {
  Alineacion,
  EquipoDePartido,
  EntrenadorPublico,
  Cruce,
  EquipoDeGrupo,
  EquipoInscrito,
  EstadoTorneo,
  Goleador,
  Grupo,
  GrupoConEquipos,
  JugadorInscrito,
  Partido,
  PartidoConEquipos,
  Penales,
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

  /** Plantilla de un equipo en el torneo (consulta publica). */
  jugadoresDeEquipo(idTorneo: number, idEquipo: number): Observable<JugadorInscrito[]> {
    return this.http.get<JugadorInscrito[]>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}/jugadores`);
  }

  /** Entrenadores del equipo, solo datos publicos. */
  entrenadoresDeEquipo(idTorneo: number, idEquipo: number): Observable<EntrenadorPublico[]> {
    return this.http.get<EntrenadorPublico[]>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}/entrenadores`);
  }

  /** Los dos equipos de un partido (consulta publica). */
  equiposDePartido(idPartido: number): Observable<EquipoDePartido[]> {
    return this.http.get<EquipoDePartido[]>(`${API_URL}/partidos/${idPartido}/equipos`);
  }

  /** Alineacion de un partido con los minutos jugados (consulta publica). */
  alineacion(idPartido: number): Observable<Alineacion[]> {
    return this.http.get<Alineacion[]>(`${API_URL}/partidos/${idPartido}/alineacion`);
  }

  /** Tanda de penales de un partido (consulta publica). */
  penales(idPartido: number): Observable<Penales> {
    return this.http.get<Penales>(`${API_URL}/partidos/${idPartido}/penales`);
  }

  /** Tandas de penales de todos los partidos del torneo que tuvieron una. */
  penalesDeTorneo(idTorneo: number): Observable<Penales[]> {
    return this.http.get<Penales[]>(`${API_URL}/torneos/${idTorneo}/penales`);
  }

  /** Cruces de una ronda eliminatoria (consulta publica). */
  cruces(id: number, ronda: string): Observable<Cruce[]> {
    const params = new HttpParams().set('ronda', ronda);
    return this.http.get<Cruce[]>(`${API_URL}/torneos/${id}/cruces`, { params });
  }

  /** Grupos del torneo con sus equipos (el backend da los equipos de cada grupo por aparte). Consulta publica. */
  grupos(id: number): Observable<GrupoConEquipos[]> {
    return this.http.get<Grupo[]>(`${API_URL}/torneos/${id}/grupos`).pipe(
      switchMap((grupos) =>
        grupos.length === 0
          ? of([])
          : forkJoin(grupos.map((g) => this.http.get<EquipoDeGrupo[]>(`${API_URL}/grupos/${g.idGrupo}/equipos`))).pipe(
              map((equipos) =>
                grupos
                  .map((g, i): GrupoConEquipos => ({ ...g, equipos: equipos[i] }))
                  .sort((a, b) => a.letra.localeCompare(b.letra) || a.idGrupo - b.idGrupo),
              ),
            ),
      ),
    );
  }

  posiciones(id: number): Observable<Posicion[]> {
    return this.http.get<Posicion[]>(`${API_URL}/torneos/${id}/posiciones`);
  }

  /** fase: 'grupos' (solo fase de grupos), 'eliminatoria' (despues de grupos) o sin indicar (todo el torneo). */
  goleadores(id: number, limite = 10, fase?: 'grupos' | 'eliminatoria'): Observable<Goleador[]> {
    let params = new HttpParams().set('limite', limite);
    if (fase) {
      params = params.set('fase', fase);
    }
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
