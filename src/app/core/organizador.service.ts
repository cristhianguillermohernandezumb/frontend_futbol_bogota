import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, last, switchMap } from 'rxjs';

import { API_URL } from './config';
import {
  Alineacion,
  Arbitro,
  ArbitroAsignado,
  ArbitroRequest,
  Cancha,
  CanchaRequest,
  Equipo,
  EquipoDePartido,
  EquipoInscrito,
  EventoPartido,
  Cruce,
  CruceRequest,
  EquipoDeGrupo,
  Grupo,
  GrupoRequest,
  EventoRequest,
  EquipoRequest,
  EstadoPartido,
  EstadoTorneo,
  RolArbitro,
  Entrenador,
  EntrenadorRequest,
  Jugador,
  JugadorInscrito,
  JugadorRequest,
  CopiaAlineacion,
  Partido,
  PartidoRequest,
  Penales,
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

  /** Corrige los datos de un equipo. Con el escudo de relleno ('AA==') el backend conserva el escudo actual. */
  actualizarEquipo(idEquipo: number, datos: EquipoRequest): Observable<Equipo> {
    return this.http.put<Equipo>(`${API_URL}/equipos/${idEquipo}`, datos);
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

  actualizarJugador(idJugador: number, datos: JugadorRequest): Observable<Jugador> {
    return this.http.put<Jugador>(`${API_URL}/jugadores/${idJugador}`, datos);
  }

  /** Cambia el numero de camiseta (solo mientras el torneo esta en inscripcion). */
  cambiarCamiseta(idTorneo: number, idEquipo: number, idJugador: number, numero: number): Observable<JugadorInscrito> {
    const params = new HttpParams().set('numero', numero);
    return this.http.patch<JugadorInscrito>(
      `${API_URL}/torneos/${idTorneo}/equipos/${idEquipo}/jugadores/${idJugador}/camiseta`,
      null,
      { params },
    );
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

  /** Cambia solo el escudo de un equipo: el cuerpo es la imagen tal cual. */
  cambiarEscudo(idEquipo: number, imagen: File): Observable<void> {
    return this.http.put<void>(`${API_URL}/equipos/${idEquipo}/escudo`, imagen, {
      headers: { 'Content-Type': imagen.type },
    });
  }

  // Entrenadores (pertenecen a un equipo)

  entrenadoresDeEquipo(idEquipo: number): Observable<Entrenador[]> {
    const params = new HttpParams().set('idEquipo', idEquipo);
    return this.http.get<Entrenador[]>(`${API_URL}/entrenadores`, { params });
  }

  crearEntrenador(datos: EntrenadorRequest): Observable<Entrenador> {
    return this.http.post<Entrenador>(`${API_URL}/entrenadores`, datos);
  }

  eliminarEntrenador(idEntrenador: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/entrenadores/${idEntrenador}`);
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

  // Partido: alineacion y eventos

  partido(id: number): Observable<Partido> {
    return this.http.get<Partido>(`${API_URL}/partidos/${id}`);
  }

  equiposDePartido(id: number): Observable<EquipoDePartido[]> {
    return this.http.get<EquipoDePartido[]>(`${API_URL}/partidos/${id}/equipos`);
  }

  alineacion(idPartido: number): Observable<Alineacion[]> {
    return this.http.get<Alineacion[]>(`${API_URL}/partidos/${idPartido}/alineacion`);
  }

  agregarAlineacion(idPartido: number, idEquipo: number, idJugador: number, titular: boolean): Observable<Alineacion> {
    const params = new HttpParams().set('titular', titular ? 'S' : 'N');
    return this.http.post<Alineacion>(
      `${API_URL}/partidos/${idPartido}/equipos/${idEquipo}/alineacion/${idJugador}`,
      null,
      { params },
    );
  }

  /** Copia la ultima alineacion que uso el equipo (su partido anterior mas reciente). */
  copiarAlineacionAnterior(idPartido: number, idEquipo: number): Observable<CopiaAlineacion> {
    return this.http.post<CopiaAlineacion>(`${API_URL}/partidos/${idPartido}/equipos/${idEquipo}/alineacion/anterior`, null);
  }

  /** Cambia titular/suplente (antes de empezar) o los minutos jugados (con el partido en juego o terminado). */
  actualizarAlineacion(
    idPartido: number,
    idEquipo: number,
    idJugador: number,
    cambios: { titular?: boolean; minutos?: number },
  ): Observable<Alineacion> {
    let params = new HttpParams();
    if (cambios.titular !== undefined) {
      params = params.set('titular', cambios.titular ? 'S' : 'N');
    }
    if (cambios.minutos !== undefined) {
      params = params.set('minutos', cambios.minutos);
    }
    return this.http.patch<Alineacion>(
      `${API_URL}/partidos/${idPartido}/equipos/${idEquipo}/alineacion/${idJugador}`,
      null,
      { params },
    );
  }

  quitarAlineacion(idPartido: number, idEquipo: number, idJugador: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/partidos/${idPartido}/equipos/${idEquipo}/alineacion/${idJugador}`);
  }

  eventos(idPartido: number): Observable<EventoPartido[]> {
    return this.http.get<EventoPartido[]>(`${API_URL}/partidos/${idPartido}/eventos`);
  }

  registrarEvento(datos: EventoRequest): Observable<EventoPartido> {
    return this.http.post<EventoPartido>(`${API_URL}/eventos`, datos);
  }

  eliminarEvento(idEvento: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/eventos/${idEvento}`);
  }

  // Grupos

  crearGrupo(datos: GrupoRequest): Observable<Grupo> {
    return this.http.post<Grupo>(`${API_URL}/grupos`, datos);
  }

  eliminarGrupo(idGrupo: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/grupos/${idGrupo}`);
  }

  asignarEquipoAGrupo(idGrupo: number, idEquipo: number): Observable<EquipoDeGrupo> {
    return this.http.post<EquipoDeGrupo>(`${API_URL}/grupos/${idGrupo}/equipos/${idEquipo}`, null);
  }

  quitarEquipoDeGrupo(idGrupo: number, idEquipo: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/grupos/${idGrupo}/equipos/${idEquipo}`);
  }

  // Cruces de eliminatorias

  guardarCruces(idTorneo: number, ronda: string, cruces: CruceRequest[]): Observable<Cruce[]> {
    return this.http.put<Cruce[]>(`${API_URL}/torneos/${idTorneo}/cruces/${ronda}`, cruces);
  }

  borrarCruces(idTorneo: number, ronda: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/torneos/${idTorneo}/cruces/${ronda}`);
  }

  // Penales

  registrarPenal(idPartido: number, convertido: boolean): Observable<Penales> {
    const params = new HttpParams().set('convertido', convertido);
    return this.http.post<Penales>(`${API_URL}/partidos/${idPartido}/penales`, null, { params });
  }

  deshacerPenal(idPartido: number): Observable<Penales> {
    return this.http.delete<Penales>(`${API_URL}/partidos/${idPartido}/penales/ultimo`);
  }
}
