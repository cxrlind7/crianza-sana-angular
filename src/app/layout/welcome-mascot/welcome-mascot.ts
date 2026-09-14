import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import confetti from 'canvas-confetti';
import { ApiService } from '../../core/services/api.service';
import { filterPublished } from '../../core/utils/schedule';

const GREETED_KEY = 'cs-mascot-greeted';
const ROTATE_INTERVAL = 40000;
const BUBBLE_DURATION = 7000;
const MAX_BLOG_TIPS = 3;

interface MascotMessage {
  text: string;
  blogId: string | null;
}

const RANDOM_TIPS: string[] = [
  '💡 Tip: la constancia en la rutina ayuda mucho a los peques a sentirse seguros.',
  '❤️ Recuerda: no existen papás perfectos, solo papás que se esfuerzan cada día.',
  '🩺 Agendar revisiones periódicas ayuda a detectar cambios a tiempo.',
  '🎧 ¡Escúchanos en Spotify! Tenemos contenido nuevo cada semana.',
  '📅 No te pierdas nuestros programas y eventos en vivo.',
  '🧠 Un ratito de juego al día fortalece muchísimo el vínculo con tus hijos.',
  '🥗 Pequeños cambios en la alimentación pueden hacer una gran diferencia.',
  '😴 Dormir bien también es parte fundamental de una crianza sana.',
];

@Component({
  selector: 'app-welcome-mascot',
  templateUrl: './welcome-mascot.html',
  styleUrl: './welcome-mascot.scss',
})
export class WelcomeMascot implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly showBubble = signal(false);
  readonly currentMessage = signal<MascotMessage>({
    text: '¡Hola! 👋 Bienvenido a Crianza Sana. Estoy aquí por si necesitas algo.',
    blogId: null,
  });

  private readonly currentUrl = signal(this.router.url);
  readonly isVisible = computed(() => {
    const url = this.currentUrl();
    return !(url === '/programs' || /^\/blog\/[^/]+$/.test(url));
  });

  private blogTips: MascotMessage[] = [];
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private rotateTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.currentUrl.set(e.urlAfterRedirects));
  }

  async ngOnInit(): Promise<void> {
    if (sessionStorage.getItem(GREETED_KEY) !== '1') {
      sessionStorage.setItem(GREETED_KEY, '1');
      this.openBubble(this.currentMessage());
    }
    await this.loadBlogTips();
    this.scheduleRotation();
  }

  ngOnDestroy(): void {
    this.clearAutoHide();
    if (this.rotateTimer) clearInterval(this.rotateTimer);
  }

  private clearAutoHide(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  private scheduleAutoHide(): void {
    this.clearAutoHide();
    this.autoHideTimer = setTimeout(() => {
      this.showBubble.set(false);
    }, BUBBLE_DURATION);
  }

  private pickRandomMessage(): MascotMessage {
    const pool: MascotMessage[] = [
      ...RANDOM_TIPS.map((text) => ({ text, blogId: null })),
      ...this.blogTips,
    ];
    if (pool.length === 0) return this.currentMessage();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private openBubble(message: MascotMessage): void {
    this.currentMessage.set(message);
    this.showBubble.set(true);
    this.scheduleAutoHide();
  }

  private scheduleRotation(): void {
    if (this.rotateTimer) clearInterval(this.rotateTimer);
    this.rotateTimer = setInterval(() => {
      this.openBubble(this.pickRandomMessage());
    }, ROTATE_INTERVAL);
  }

  private async loadBlogTips(): Promise<void> {
    try {
      const blogs = await this.api.getBlogs();
      const parseDate = (d: unknown): Date => {
        if (!d) return new Date(0);
        return new Date(d as string);
      };
      this.blogTips = filterPublished(blogs as (typeof blogs[number] & { publishAt?: string })[])
        .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
        .slice(0, MAX_BLOG_TIPS)
        .map((blog) => ({
          text: `📰 Nuevo en el blog: "${blog.title}" — ¡échale un ojo!`,
          blogId: blog.id,
        }));
    } catch {
      this.blogTips = [];
    }
  }

  toggleBubble(): void {
    if (this.showBubble()) {
      this.showBubble.set(false);
      this.clearAutoHide();
    } else {
      this.openBubble(this.pickRandomMessage());
    }
  }

  closeBubble(): void {
    this.showBubble.set(false);
    this.clearAutoHide();
  }

  goToBlog(): void {
    const blogId = this.currentMessage().blogId;
    if (!blogId) return;
    this.closeBubble();
    this.router.navigate(['/blog', blogId]);
  }

  throwConfetti(): void {
    confetti({
      particleCount: 120,
      spread: 70,
      startVelocity: 45,
      angle: 65,
      origin: { x: 0.08, y: 0.95 },
      colors: ['#ff8fa3', '#9b5de5', '#4fb0e8', '#ffd166', '#06d6a0'],
    });
  }
}
