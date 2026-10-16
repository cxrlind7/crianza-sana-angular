import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Especialista, setPeople } from '../utils/people-visibility';

/** Carga de especialistas y colaboradores desde /api/especialistas. */
@Injectable({ providedIn: 'root' })
export class PeopleStore {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.backendUrl}/api/especialistas`;

  readonly loaded = signal(false);
  readonly error = signal(false);

  /**
   * Se llama al arrancar la app (app.config.ts) y después de editar en Configuración.
   * `fresh` evita cualquier copia en caché del navegador (para ver el cambio recién guardado).
   */
  async load(fresh = false): Promise<void> {
    try {
      const url = fresh ? `${this.api}?t=${Date.now()}` : this.api;
      const list = await firstValueFrom(this.http.get<Especialista[]>(url).pipe(timeout(5000)));
      setPeople(list);
      this.error.set(false);
    } catch (error) {
      console.error('❌ No se pudieron cargar los especialistas:', error);
      this.error.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  // ---------------------------------------------------------------- Admin

  create(data: Partial<Especialista>): Promise<{ id: number }> {
    return firstValueFrom(this.http.post<{ id: number }>(this.api, data));
  }

  update(id: number, data: Partial<Especialista>): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.api}/${id}`, data));
  }

  reorder(ids: number[]): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.api}/orden`, { ids }));
  }

  remove(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.api}/${id}`));
  }
}
