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
  idLocal: number | null;
  idVisitante: number | null;
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

export interface TorneoRequest {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  telefono: number;
  modalidad: Modalidad;
  categoria: string;
  costoInscripcion: number;
  maxEquipos: number;
  idOrganizador: number;
}

export interface Equipo {
  idEquipo: number;
  nombre: string;
  fechaFundacion: string;
  correo: string;
  telefonoEquipo: number;
}

export interface EquipoRequest {
  nombre: string;
  fechaFundacion: string;
  correo: string;
  telefonoEquipo: number;
  /** Imagen en base64 (el backend la recibe como byte[]). */
  escudo: string;
}

export type TipoSuperficie = 'SINTETICA' | 'NATURAL' | 'CEMENTO';

export interface Cancha {
  idCancha: number;
  nombre: string;
  direccion: string;
  tipoSuperficie: TipoSuperficie;
  localidad: string;
  capacidad: number;
  largo: number;
  ancho: number;
}

export type CanchaRequest = Omit<Cancha, 'idCancha'>;

export interface PartidoRequest {
  fechaHora: string;
  estado: EstadoPartido;
  fase: string;
  jornada: number;
  idCancha: number;
  idTorneo: number;
}

export type TipoDocumento = 'CC' | 'CE' | 'TI' | 'PAS';
export type PiernaHabil = 'DERECHA' | 'IZQUIERDA' | 'AMBIDIESTRO';
export type PosicionJugador = 'PORTERO' | 'DEFENSA' | 'VOLANTE' | 'DELANTERO';
export type EstadoJugador = 'ACTIVO' | 'LESIONADO' | 'SUSPENDIDO';

export interface JugadorRequest {
  documento: string;
  tipoDocumento: TipoDocumento;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  fechaNacimiento: string;
  estatura: number;
  peso: number;
  piernaHabil: PiernaHabil;
  nacionalidad: string;
  estado: EstadoJugador;
  posicion: PosicionJugador;
  correos: string[];
  telefonos: string[];
}

export interface Jugador extends JugadorRequest {
  idJugador: number;
}

export interface JugadorInscrito {
  idJugador: number;
  nombreJugador: string;
  idEquipo: number;
  idTorneo: number;
  numeroCamiseta: number;
  piernaHabil: PiernaHabil;
}

export type RolArbitro = 'CENTRAL' | 'ASISTENTE_1' | 'ASISTENTE_2' | 'CUARTO' | 'VAR';

export interface ArbitroRequest {
  documento: string;
  tipoDocumento: TipoDocumento;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  fechaNacimiento: string;
  numeroLicencia: number;
  nacionalidad: string;
  estado: 'ACTIVO' | 'INACTIVO';
  correos: string[];
  telefonos: string[];
}

export interface Arbitro extends ArbitroRequest {
  idArbitro: number;
}

export interface ArbitroAsignado {
  idPartido: number;
  idArbitro: number;
  nombreArbitro: string;
  rol: RolArbitro;
}

export interface Alineacion {
  idPartido: number;
  idEquipo: number;
  idTorneo: number;
  idJugador: number;
  nombreJugador: string;
  /** S = titular, N = suplente. */
  titular: 'S' | 'N';
  minutosJugados: number;
}

export type TipoEvento = 'GOL' | 'AUTOGOL' | 'AMARILLA' | 'ROJA' | 'FALTA';

export interface EventoPartido {
  idEvento: number;
  minuto: number;
  tipoEvento: TipoEvento;
  idPartido: number;
  idEquipo: number;
  idTorneo: number;
  idJugador: number;
  nombreJugador: string;
}

export interface EventoRequest {
  minuto: number;
  tipoEvento: TipoEvento;
  idPartido: number;
  idEquipo: number;
  idTorneo: number;
  idJugador: number;
}

export interface Seguimiento {
  idTorneo: number;
  nombreTorneo: string;
  idUsuario: number;
  fechaSeguimiento: string;
  /** S = quiere recibir avisos, N = no. */
  notificacion: 'S' | 'N';
}

export interface PerfilRequest {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  telefono: number | null;
  correo: string;
  /** Opcional: si no se envia, se conserva la contrasena actual. */
  contrasenia?: string;
}

export interface AuditoriaRegistro {
  idAuditoria: number;
  detalle: string | null;
  fechaHora: string;
  entidad: string;
  idRegistro: string | null;
  accion: string;
  idUsuario: number;
  nombreUsuario: string;
  idTorneo: number | null;
}

export interface Entrenador {
  idEntrenador: number;
  documento: string;
  tipoDocumento: TipoDocumento;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  fechaNacimiento: string;
  aniosExperiencia: number;
  nacionalidad: string;
  idEquipo: number;
  nombreEquipo: string;
  correos: string[];
  telefonos: string[];
}

export interface EntrenadorRequest {
  documento: string;
  tipoDocumento: TipoDocumento;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  fechaNacimiento: string;
  aniosExperiencia: number;
  nacionalidad: string;
  idEquipo: number;
  correos: string[];
  telefonos: string[];
}

/** Lo que cualquier visitante puede ver de un entrenador (sin documento ni contacto). */
export interface EntrenadorPublico {
  idEntrenador: number;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  aniosExperiencia: number;
  nacionalidad: string;
}

/** Formato de error que devuelve el backend (GlobalExceptionHandler). */
export interface ErrorApi {
  fecha: string;
  estado: number;
  mensaje: string;
  detalles?: Record<string, string>;
}

/** Grupo de un torneo (letra A, B, C...) con los equipos que lo componen. */
export interface Grupo {
  idGrupo: number;
  fase: number;
  letra: string;
  idTorneo: number;
}

export interface EquipoDeGrupo {
  idGrupo: number;
  letraGrupo: string;
  idTorneo: number;
  idEquipo: number;
  nombreEquipo: string;
}

export interface GrupoConEquipos extends Grupo {
  equipos: EquipoDeGrupo[];
}

export interface GrupoRequest {
  fase: number;
  letra: string;
  idTorneo: number;
}

/** Cruce de una ronda eliminatoria: quien juega contra quien (el partido se crea despues). */
export interface Cruce {
  idCruce: number;
  idTorneo: number;
  ronda: string;
  orden: number;
  idLocal: number;
  nombreLocal: string;
  idVisitante: number;
  nombreVisitante: string;
}

export interface CruceRequest {
  idLocal: number;
  idVisitante: number;
}

/** Un tiro de la tanda de penales. */
export interface TiroPenal {
  orden: number;
  idEquipo: number;
  rol: 'LOCAL' | 'VISITANTE';
  convertido: boolean;
}

/**
 * Tanda de penales de un partido de eliminatoria empatado. siguiente = quien patea el proximo tiro;
 * ganador = quien gano la tanda (null mientras siga abierta).
 */
export interface Penales {
  idPartido: number;
  idLocal: number;
  idVisitante: number;
  aplica: boolean;
  tiros: TiroPenal[];
  golesLocal: number;
  golesVisitante: number;
  siguiente: 'LOCAL' | 'VISITANTE' | null;
  ganador: 'LOCAL' | 'VISITANTE' | null;
  idGanador: number | null;
}

/** Resultado de copiar la ultima alineacion usada por un equipo. */
export interface CopiaAlineacion {
  idPartidoOrigen: number;
  agregados: Alineacion[];
  /** Jugadores que no se pudieron copiar (no inscritos en este torneo o ya en el partido). */
  omitidos: number;
}
