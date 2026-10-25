export type Rol = 'ADMIN' | 'ORGANIZADOR' | 'ESPECTADOR';
export type EstadoTorneo = 'INSCRIPCION' | 'EN_CURSO' | 'FINALIZADO';
export type Modalidad = 'FUTBOL_5' | 'FUTBOL_7' | 'FUTBOL_8' | 'FUTBOL_11';

export interface Usuario {
  idUsuario: number;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  fechaRegistro: string;
  rol: Rol;
  telefono: number | null;
  correo: string;
  estado: string;
}

export interface LoginRequest {
  correo: string;
  contrasenia: string;
}

export interface LoginResponse {
  token: string;
  tipo: string;
  expiraEnMinutos: number;
  usuario: Usuario;
}

/** Los usuarios nuevos solo pueden ser ESPECTADOR u ORGANIZADOR (el ADMIN se asigna en la base). */
export interface RegistroRequest {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  telefono: number | null;
  correo: string;
  contrasenia: string;
  rol: 'ESPECTADOR' | 'ORGANIZADOR';
}

export interface Torneo {
  idTorneo: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoTorneo;
  telefono: number;
  modalidad: Modalidad;
  categoria: string;
  costoInscripcion: number;
  maxEquipos: number;
  idOrganizador: number;
  nombreOrganizador: string;
}

export interface EquipoInscrito {
  idEquipo: number;
  nombreEquipo: string;
  idTorneo: number;
  nombreTorneo: string;
  estadoInscripcion: string;
  fechaInscripcion: string;
}

export type EstadoPartido = 'PROGRAMADO' | 'EN_JUEGO' | 'FINALIZADO' | 'APLAZADO';

export interface Partido {
  idPartido: number;
  fechaHora: string;
  estado: EstadoPartido;
  golesLocal: number;
  golesVisitante: number;
  fase: string;
  jornada: number;
  idCancha: number;
  nombreCancha: string;
  idTorneo: number;
}

export interface EquipoDePartido {
  idPartido: number;
  idEquipo: number;
  nombreEquipo: string;
  idTorneo: number;
  rol: 'LOCAL' | 'VISITANTE';
}

/** Partido junto con los nombres de sus dos equipos (se arma en el frontend). */
export interface PartidoConEquipos extends Partido {
  local: string | null;
  visitante: string | null;
}

export interface Posicion {
  posicion: number;
  idEquipo: number;
  nombreEquipo: string;
  partidosJugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferenciaGoles: number;
  puntos: number;
}

export interface Goleador {
  posicion: number;
  idJugador: number;
  nombreJugador: string;
  idEquipo: number;
  nombreEquipo: string;
  goles: number;
}

/** Formato de error que devuelve el backend (GlobalExceptionHandler). */
export interface ErrorApi {
  fecha: string;
  estado: number;
  mensaje: string;
  detalles?: Record<string, string>;
}
