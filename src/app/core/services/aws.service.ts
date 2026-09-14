import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AwsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl;

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

  async getUploadUrl(key: string, contentType: string): Promise<string | null> {
    if (!key) {
      console.error('❌ Error: Key no proporcionada para getUploadUrl');
      return null;
    }
    try {
      const response = await firstValueFrom(
        this.http.post<{ url: string }>(`${this.baseUrl}/api/aws/upload-url`, { key, contentType }),
      );
      return response.url;
    } catch (error) {
      console.error('❌ Error obteniendo URL de subida del backend:', error);
      return null;
    }
  }
}
