import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, last, switchMap } from 'rxjs';

import { API_URL } from './config';
import {
  Arbitro,
  ArbitroAsignado,
  ArbitroRequest,
  Cancha,
  CanchaRequest,
  Equipo,
  EquipoInscrito,
  EquipoRequest,
  EstadoPartido,
  EstadoTorneo,
  RolArbitro,
  Jugador,
  JugadorInscrito,
  JugadorRequest,
  Partido,
  PartidoRequest,
  Torneo,
  TorneoRequest,
} from './models';

/** Llamadas que solo hace un organizador (o admin): crear y modificar. El backend vuelve a validar cada permiso. */
@Injectable({ providedIn: 'root' })
export class OrganizadorService {
  private readonly http = inject(HttpClient);

  torneosDe(idUsuario: number): Observable<Torneo[]> {
    return this.http.get<Torneo[]>(`${API_URL}/torneos/organizador/${idUsuario}`);
  }

  crearTorneo(datos: TorneoRequest): Observable<Torneo> {
    return this.http.post<Torneo>(`${API_URL}/torneos`, datos);
  }

  cambiarEstadoTorneo(id: number, valor: EstadoTorneo): Observable<Torneo> {
    const params = new HttpParams().set('valor', valor);
    return this.http.patch<Torneo>(`${API_URL}/torneos/${id}/estado`, null, { params });
  }

  // Equipos

  equipos(): Observable<Equipo[]> {
    return this.http.get<Equipo[]>(`${API_URL}/equipos`);
  }

  crearEquipo(datos: EquipoRequest): Observable<Equipo> {
    return this.http.post<Equipo>(`${API_URL}/equipos`, datos);
  }

  inscribir(idTorneo: number, idEquipo: number): Observable<EquipoInscrito> {
    return this.http.post<EquipoInscrito>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}`, null);
  }

  marcarPagada(idTorneo: number, idEquipo: number): Observable<EquipoInscrito> {
    return this.http.patch<EquipoInscrito>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}/pagar`, null);
  }

  retirar(idTorneo: number, idEquipo: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}`);
  }

  // Canchas y partidos

  canchas(): Observable<Cancha[]> {
    return this.http.get<Cancha[]>(`${API_URL}/canchas`);
  }

  crearCancha(datos: CanchaRequest): Observable<Cancha> {
    return this.http.post<Cancha>(`${API_URL}/canchas`, datos);
  }

  /** Crea el partido y le asigna los dos equipos (uno detras de otro: el backend valida cada asignacion). */
  programarPartido(datos: PartidoRequest, idLocal: number, idVisitante: number): Observable<unknown> {
    return this.http.post<Partido>(`${API_URL}/partidos`, datos).pipe(
      switchMap((p) =>
        concat(this.asignarEquipo(p.idPartido, idLocal, 'LOCAL'), this.asignarEquipo(p.idPartido, idVisitante, 'VISITANTE')).pipe(
          last(),
        ),
      ),
    );
  }

  private asignarEquipo(idPartido: number, idEquipo: number, rol: 'LOCAL' | 'VISITANTE'): Observable<unknown> {
    const params = new HttpParams().set('rol', rol);
    return this.http.post(`${API_URL}/partidos/${idPartido}/equipos/${idEquipo}`, null, { params });
  }

  cambiarEstadoPartido(id: number, valor: EstadoPartido): Observable<Partido> {
    const params = new HttpParams().set('valor', valor);
    return this.http.patch<Partido>(`${API_URL}/partidos/${id}/estado`, null, { params });
  }

  eliminarPartido(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/partidos/${id}`);
  }

  // Jugadores

  jugadores(): Observable<Jugador[]> {
    return this.http.get<Jugador[]>(`${API_URL}/jugadores`);
  }

  jugadoresDeEquipo(idTorneo: number, idEquipo: number): Observable<JugadorInscrito[]> {
    return this.http.get<JugadorInscrito[]>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}/jugadores`);
  }

  crearJugador(datos: JugadorRequest): Observable<Jugador> {
    return this.http.post<Jugador>(`${API_URL}/jugadores`, datos);
  }

  inscribirJugador(
    idTorneo: number,
    idEquipo: number,
    idJugador: number,
    numeroCamiseta: number,
  ): Observable<JugadorInscrito> {
    return this.http.post<JugadorInscrito>(`${API_URL}/inscripciones-jugador`, {
      idJugador,
      idEquipo,
      idTorneo,
      numeroCamiseta,
    });
  }

  retirarJugador(idTorneo: number, idEquipo: number, idJugador: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}/jugadores/${idJugador}`);
  }

  // Arbitros

  arbitros(): Observable<Arbitro[]> {
    return this.http.get<Arbitro[]>(`${API_URL}/arbitros`);
  }

  crearArbitro(datos: ArbitroRequest): Observable<Arbitro> {
    return this.http.post<Arbitro>(`${API_URL}/arbitros`, datos);
  }

  arbitrosDePartido(idPartido: number): Observable<ArbitroAsignado[]> {
    return this.http.get<ArbitroAsignado[]>(`${API_URL}/partidos/${idPartido}/arbitros`);
  }

  asignarArbitro(idPartido: number, idArbitro: number, rol: RolArbitro): Observable<ArbitroAsignado> {
    const params = new HttpParams().set('rol', rol);
    return this.http.post<ArbitroAsignado>(`${API_URL}/partidos/${idPartido}/arbitros/${idArbitro}`, null, { params });
  }

  quitarArbitro(idPartido: number, idArbitro: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/partidos/${idPartido}/arbitros/${idArbitro}`);
  }
}
