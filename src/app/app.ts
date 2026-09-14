import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
export class App {}
