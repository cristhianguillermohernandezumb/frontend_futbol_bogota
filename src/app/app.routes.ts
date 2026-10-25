import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home), title: 'Fútbol Bogotá' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login), title: 'Ingresar' },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
    title: 'Crear cuenta',
  },
  { path: '**', redirectTo: '' },
];
