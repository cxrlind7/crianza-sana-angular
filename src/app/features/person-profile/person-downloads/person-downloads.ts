import { Component, Input, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface DownloadFile {
  name: string;
  url: string;
}

@Component({
  selector: 'app-person-downloads',
  templateUrl: './person-downloads.html',
  styleUrl: './person-downloads.scss',
})
export class PersonDownloads {
  @Input() files: DownloadFile[] = [];
  @Input() personColor = '#0d6efd';

  private readonly sanitizer = inject(DomSanitizer);

  readonly showModal = signal(false);
  readonly currentFileUrl = signal<SafeResourceUrl | null>(null);

  openPreview(file: DownloadFile): void {
    const previewUrl = this.getPreviewUrl(file.url);
    if (previewUrl) {
      this.currentFileUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl));
      this.showModal.set(true);
      document.body.style.overflow = 'hidden';
    } else {
      console.warn('No se puede previsualizar este tipo de archivo o la URL es inválida.');
      window.open(file.url, '_blank');
    }
  }

  closePreview(): void {
    this.showModal.set(false);
    this.currentFileUrl.set(null);
    document.body.style.overflow = '';
  }

  private getPreviewUrl(url: string): string {
    if (!url) return '';

    if (url.includes('drive.google.com')) {
      try {
        const urlObj = new URL(url);
        let cleanPath = urlObj.origin + urlObj.pathname;
        cleanPath = cleanPath.replace(/\/view\/?$/, '').replace(/\/$/, '');
        return `${cleanPath}/preview`;
      } catch {
        return url;
      }
    }

    return url;
  }
}
