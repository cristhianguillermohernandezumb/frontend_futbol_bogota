import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { API_URL } from './config';

/** Agrega el token a cada peticion al backend y cierra la sesion si el backend responde 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const peticion =
    token && req.url.startsWith(API_URL)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(peticion).pipe(
    catchError((err: unknown) => {
      // Con token y 401, la sesion se venció o el usuario fue desactivado.
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
        auth.cerrarSesion('expirada');
      }
      return throwError(() => err);
    }),
  );
};
