import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { Rol } from './models';

/** Deja pasar solo a quien haya iniciado sesion; si no, lo manda al login y luego lo regresa aqui. */
export const sesionGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado() || router.createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

/** Deja pasar solo a los roles indicados. Ejemplo: canActivate: [rolGuard('ORGANIZADOR', 'ADMIN')] */
export const rolGuard =
  (...roles: Rol[]): CanActivateFn =>
  (_ruta, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.autenticado()) {
      return router.createUrlTree(['/login'], { queryParams: { volver: estado.url } });
    }
    return auth.tieneRol(...roles) || router.createUrlTree(['/']);
  };
