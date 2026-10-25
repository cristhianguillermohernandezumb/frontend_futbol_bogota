import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home), title: 'La CanchaRola' },
  {
    path: 'torneos/:id',
    loadComponent: () => import('./pages/torneo-detalle/torneo-detalle').then((m) => m.TorneoDetalle),
    title: 'Torneo',
  },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login), title: 'Ingresar' },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
    title: 'Crear cuenta',
  },
  { path: '**', redirectTo: '' },
];
