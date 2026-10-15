import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, input, output, signal } from '@angular/core';

/**
 * Ventana emergente para reproducir un video. Se ajusta a la proporción real del video
 * (vertical u horizontal) y se monta en <body>: un ancestro con `transform` (las animaciones
 * `.fade-in`) rompería el centrado de un `position: fixed`.
 */
@Component({
  selector: 'app-video-modal',
  templateUrl: './video-modal.html',
  styleUrl: './video-modal.scss',
})
export class VideoModal implements AfterViewInit, OnDestroy {
  readonly url = input.required<string>();
  readonly title = input('');
  readonly poster = input('');
  /** Encabezado visible arriba del video, p. ej. "Conociendo a Carina". */
  readonly heading = input('');
  readonly closed = output<void>();

  /** Proporción del video; arranca vertical y se corrige al cargar los metadatos. */
  readonly aspect = signal(9 / 16);

  @ViewChild('overlay') overlay?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    const el = this.overlay?.nativeElement;
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.overlay?.nativeElement.remove();
    document.body.style.overflow = '';
  }

  onMetadata(video: HTMLVideoElement): void {
    if (video.videoWidth && video.videoHeight) this.aspect.set(video.videoWidth / video.videoHeight);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
