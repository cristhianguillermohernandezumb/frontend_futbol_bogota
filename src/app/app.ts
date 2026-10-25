import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { Rol } from './core/models';

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  ORGANIZADOR: 'Organizador',
  ESPECTADOR: 'Espectador',
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);

  protected etiquetaRol(rol: Rol): string {
    return ETIQUETA_ROL[rol];
  }
}
