import { HttpErrorResponse } from '@angular/common/http';
import { ErrorApi } from './models';

/** Convierte cualquier error de HTTP en un texto que se pueda mostrar al usuario. */
export function mensajeDeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo.';
    }
    const cuerpo = err.error as Partial<ErrorApi> | null;
    if (cuerpo?.detalles) {
      const lista = Object.values(cuerpo.detalles).join('. ');
      return `${cuerpo.mensaje ?? 'Hay datos inválidos'}: ${lista}`;
    }
    if (cuerpo?.mensaje) {
      return cuerpo.mensaje;
    }
    return `El servidor respondió con el error ${err.status}.`;
  }
  return 'Ocurrió un error inesperado.';
}
