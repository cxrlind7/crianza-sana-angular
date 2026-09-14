import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import confetti from 'canvas-confetti';

const DISMISS_KEY = 'cs-anniversary-dismissed';
const FESTIVE_COLORS = ['#ff8fa3', '#9b5de5', '#4fb0e8', '#ffd166', '#06d6a0'];

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

@Component({
  selector: 'app-anniversary-banner',
  templateUrl: './anniversary-banner.html',
  styleUrl: './anniversary-banner.scss',
})
export class AnniversaryBanner implements OnInit, OnDestroy {
  readonly dismissed = signal(sessionStorage.getItem(DISMISS_KEY) === '1');

  private readonly isAnniversaryPeriod = (() => {
    const now = new Date();
    return now.getFullYear() === 2026 && now.getMonth() === 8;
  })();

  readonly showBanner = signal(this.isAnniversaryPeriod && !this.dismissed());

  private running = false;
  private rafId: number | null = null;
  private burstInterval: ReturnType<typeof setInterval> | null = null;

  private burst(): void {
    confetti({
      particleCount: 90,
      spread: 100,
      origin: { y: 0.25 },
      colors: FESTIVE_COLORS,
    });
  }

  private startStreamers(): void {
    if (this.running) return;
    this.running = true;
    const duration = 18000;
    const animationEnd = Date.now() + duration;
    let skew = 1;

    const frame = () => {
      if (!this.running) return;
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        this.running = false;
        return;
      }
      skew = Math.max(0.7, skew - 0.001);

      confetti({
        particleCount: 2,
        startVelocity: 0,
        ticks: 400,
        origin: { x: Math.random(), y: Math.random() * skew - 0.2 },
        colors: FESTIVE_COLORS,
        shapes: ['square'],
        gravity: randomInRange(0.35, 0.55),
        scalar: randomInRange(0.6, 1.2),
        drift: randomInRange(-0.6, 0.6),
        disableForReducedMotion: true,
      });

      this.rafId = requestAnimationFrame(frame);
    };
    frame();
  }

  private stopEffects(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.burstInterval) clearInterval(this.burstInterval);
  }

  ngOnInit(): void {
    if (!this.isAnniversaryPeriod || this.dismissed()) return;
    this.burst();
    this.startStreamers();
    this.burstInterval = setInterval(() => this.burst(), 45000);
  }

  ngOnDestroy(): void {
    this.stopEffects();
  }

  dismiss(): void {
    this.dismissed.set(true);
    this.showBanner.set(false);
    sessionStorage.setItem(DISMISS_KEY, '1');
    this.stopEffects();
  }
}
