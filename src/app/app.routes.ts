import { Routes } from '@angular/router';

import { rolGuard, sesionGuard } from './core/guards';

const organizador = rolGuard('ORGANIZADOR', 'ADMIN');

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home), title: 'La CanchaRola' },
  {
    path: 'torneos/:id',
    loadComponent: () => import('./pages/torneo-detalle/torneo-detalle').then((m) => m.TorneoDetalle),
    title: 'Torneo',
  },
  {
    path: 'torneos/:id/equipos/:idEquipo',
    loadComponent: () => import('./pages/equipo-detalle/equipo-detalle').then((m) => m.EquipoDetalle),
    title: 'Equipo',
  },
  {
    path: 'organizador',
    canActivate: [organizador],
    loadComponent: () => import('./pages/organizador/panel/panel').then((m) => m.Panel),
    title: 'Mis torneos',
  },
  {
    path: 'organizador/torneos/nuevo',
    canActivate: [organizador],
    loadComponent: () => import('./pages/organizador/torneo-form/torneo-form').then((m) => m.TorneoForm),
    title: 'Crear torneo',
  },
  {
    path: 'organizador/torneos/:id',
    canActivate: [organizador],
    loadComponent: () => import('./pages/organizador/torneo-gestion/torneo-gestion').then((m) => m.TorneoGestion),
    title: 'Gestionar torneo',
  },
  {
    path: 'organizador/partidos/:id',
    canActivate: [organizador],
    loadComponent: () => import('./pages/organizador/partido-gestion/partido-gestion').then((m) => m.PartidoGestion),
    title: 'Partido',
  },
  {
    path: 'seguimientos',
    canActivate: [sesionGuard],
    loadComponent: () => import('./pages/seguimientos/seguimientos').then((m) => m.Seguimientos),
    title: 'Torneos que sigues',
  },
  {
    path: 'perfil',
    canActivate: [sesionGuard],
    loadComponent: () => import('./pages/perfil/perfil').then((m) => m.Perfil),
    title: 'Mi perfil',
  },
  {
    path: 'admin',
    canActivate: [rolGuard('ADMIN')],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    title: 'Administración',
  },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login), title: 'Ingresar' },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
    title: 'Crear cuenta',
  },
  { path: '**', redirectTo: '' },
];
