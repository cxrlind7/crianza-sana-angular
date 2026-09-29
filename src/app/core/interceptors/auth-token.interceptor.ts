import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { auth } from '../firebase/firebase-app';
import { environment } from '../../../environments/environment';

/**
 * Adjunta el ID token de Firebase a las peticiones a nuestra API cuando hay sesión.
 * El backend lo exige en las rutas de administración (crear/editar/borrar, suscriptores, newsletter).
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const user = auth.currentUser;
  const isOwnApi = req.url.startsWith(`${environment.backendUrl}/api/`) || req.url.startsWith('/api/');
  if (!user || !isOwnApi) return next(req);

  return from(user.getIdToken()).pipe(
    switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
};
