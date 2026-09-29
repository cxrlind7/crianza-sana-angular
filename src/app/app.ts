import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavBar } from './layout/nav-bar/nav-bar';
import { Footer } from './layout/footer/footer';
import { WhatsappWidget } from './layout/whatsapp-widget/whatsapp-widget';
import { AnniversaryBanner } from './layout/anniversary-banner/anniversary-banner';
import { WelcomeMascot } from './layout/welcome-mascot/welcome-mascot';
import { SubscribeModal } from './layout/subscribe-modal/subscribe-modal';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NavBar,
    Footer,
    WhatsappWidget,
    AnniversaryBanner,
    WelcomeMascot,
    SubscribeModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    // Al cambiar de página se vuelve arriba; los cambios de query params (abrir un video o
    // una foto) mantienen la posición.
    let lastPath = '';
    inject(Router)
      .events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (lastPath && path !== lastPath) window.scrollTo(0, 0);
        lastPath = path;
      });
  }
}
