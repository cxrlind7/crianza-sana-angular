import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// Nombres de carpeta legibles dentro del bucket, para que cualquiera que
// explore R2 identifique de qué es cada archivo sin tener que abrirlo.
const FOLDER_LABELS: Record<string, string> = {
  video: 'programas',
  'video-corto': 'videos-cortos',
  'video-conociendo': 'videos-especialistas/conociendo',
  'video-negocio': 'videos-especialistas/negocio',
  'video-educativo': 'videos-especialistas/clips',
  'video-poster': 'videos-especialistas/miniaturas',
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

  private buildKey(file: File, folder: string): string {
    const label = FOLDER_LABELS[folder] || this.slugify(folder);
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return `${label}/${this.slugify(baseName)}-${Date.now()}.${ext}`;
  }

  /**
   * Igual que uploadFile pero reporta el avance (0–100). fetch no expone el progreso de subida,
   * por eso se usa XMLHttpRequest; importa para videos de cientos de MB.
   */
  async uploadFileWithProgress(file: File, folder: string, onProgress: (pct: number) => void): Promise<string | null> {
    const contentType = file.type || 'application/octet-stream';
    const result = await this.getUploadUrl(this.buildKey(file, folder), contentType);
    if (!result) return null;
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', result.url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(result.publicUrl);
        } else {
          console.error('❌ Error subiendo archivo:', xhr.status);
          resolve(null);
        }
      };
      xhr.onerror = () => {
        console.error('❌ Error de red subiendo archivo');
        resolve(null);
      };
      xhr.send(file);
    });
  }

  async uploadFile(file: File, folder: string): Promise<string | null> {
    const key = this.buildKey(file, folder);
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
