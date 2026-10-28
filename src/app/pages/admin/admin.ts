import { Component, signal } from '@angular/core';

import { AuditoriaAdmin } from './auditoria-admin';
import { UsuariosAdmin } from './usuarios-admin';

type Pestana = 'usuarios' | 'auditoria';

@Component({
  selector: 'app-admin',
  imports: [UsuariosAdmin, AuditoriaAdmin],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  protected readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'usuarios', texto: 'Usuarios' },
    { id: 'auditoria', texto: 'Auditoría' },
  ];
  protected readonly pestana = signal<Pestana>('usuarios');
}
