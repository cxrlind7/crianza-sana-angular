import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
  },
  {
    path: 'live',
    loadComponent: () => import('./features/live/live').then((m) => m.Live),
  },
  {
    path: 'person/:id',
    loadComponent: () => import('./features/person-profile/person-profile').then((m) => m.PersonProfile),
  },
  {
    path: 'quiz',
    loadComponent: () => import('./features/quiz/quiz').then((m) => m.Quiz),
  },
  {
    path: 'store',
    loadComponent: () => import('./features/store/store').then((m) => m.Store),
  },
  {
    path: 'store/:id',
    loadComponent: () => import('./features/store/store-detail/store-detail').then((m) => m.StoreDetail),
  },
  {
    path: 'gallery',
    loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery),
  },
  {
    path: 'programs',
    loadComponent: () => import('./features/programs/programs').then((m) => m.Programs),
  },
  {
    path: 'blog',
    loadComponent: () => import('./features/blog/blog').then((m) => m.Blog),
  },
  {
    path: 'blog/:id',
    loadComponent: () => import('./features/blog/blog-detail/blog-detail').then((m) => m.BlogDetail),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./features/analytics/analytics').then((m) => m.Analytics),
  },
  {
    path: 'configuration',
    canActivate: [authGuard],
    loadComponent: () => import('./features/configuration/configuration').then((m) => m.Configuration),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
