import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, input, output, signal } from '@angular/core';
import { CardPerson, loadQRCode, profileUrl, qrUrl, specialty } from '../../../../core/utils/person-card';

/**
 * Tarjeta digital en grande con su QR, para que otra persona la escanee desde su celular.
 * Igual que VideoModal, se monta en <body> para que el `position: fixed` no se rompa.
 */
@Component({
  selector: 'app-card-qr-modal',
  templateUrl: './card-qr-modal.html',
  styleUrl: './card-qr-modal.scss',
})
export class CardQrModal implements OnInit, AfterViewInit, OnDestroy {
  readonly person = input.required<CardPerson>();
  readonly generating = input(false);
  readonly feedback = input('');
  readonly closed = output<void>();
  readonly download = output<void>();
  readonly share = output<void>();

  readonly qr = signal('');
  readonly specialty = specialty;
  readonly displayUrl = signal('');

  @ViewChild('overlay') overlay?: ElementRef<HTMLElement>;

  async ngOnInit(): Promise<void> {
    const person = this.person();
    this.displayUrl.set(profileUrl(person).replace(/^https?:\/\//, ''));
    const QRCode = await loadQRCode();
    this.qr.set(
      await QRCode.toDataURL(qrUrl(person, 'qr'), { width: 480, margin: 1, color: { dark: '#1f2937', light: '#ffffff' } }),
    );
  }

  ngAfterViewInit(): void {
    const el = this.overlay?.nativeElement;
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.overlay?.nativeElement.remove();
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
