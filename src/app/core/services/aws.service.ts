import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// Nombres de carpeta legibles dentro del bucket, para que cualquiera que
// explore R2 identifique de qué es cada archivo sin tener que abrirlo.
const FOLDER_LABELS: Record<string, string> = {
  video: 'programas',
  'video-corto': 'videos-cortos',
  blog: 'blogs',
  ad: 'anuncios',
  banner: 'banners',
  evento: 'eventos',
  gallery: 'galeria',
  avatar: 'avatares',
  uploads: 'archivos',
};

@Injectable({ providedIn: 'root' })
export class AwsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl;

  private slugify(name: string): string {
    return (
      name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '') // quitar acentos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'archivo'
    );
  }

  async getSignedUrl(key: string): Promise<string | null> {
    if (!key) {
      console.error('❌ Error: Key no proporcionada para getSignedUrl');
      return null;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<{ url: string }>(`${this.baseUrl}/api/aws/read-url`, { params: { key } }),
      );
      return response.url;
    } catch (error) {
      console.error('❌ Error obteniendo URL firmada del backend:', error);
      return null;
    }
  }

  async getUploadUrl(key: string, contentType: string): Promise<{ url: string; publicUrl: string } | null> {
    if (!key) {
      console.error('❌ Error: Key no proporcionada para getUploadUrl');
      return null;
    }
    try {
      return await firstValueFrom(
        this.http.post<{ url: string; publicUrl: string }>(`${this.baseUrl}/api/aws/upload-url`, {
          key,
          contentType,
        }),
      );
    } catch (error) {
      console.error('❌ Error obteniendo URL de subida del backend:', error);
      return null;
    }
  }

  async uploadFile(file: File, folder: string): Promise<string | null> {
    const label = FOLDER_LABELS[folder] || this.slugify(folder);
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const key = `${label}/${this.slugify(baseName)}-${Date.now()}.${ext}`;
    const result = await this.getUploadUrl(key, file.type || 'application/octet-stream');
    if (!result) return null;
    try {
      const putResponse = await fetch(result.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putResponse.ok) {
        console.error('❌ Error subiendo archivo a S3:', putResponse.status);
        return null;
      }
      return result.publicUrl;
    } catch (error) {
      console.error('❌ Error subiendo archivo a S3:', error);
      return null;
    }
  }
}
