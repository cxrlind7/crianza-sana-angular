import { Component, OnInit } from '@angular/core';
import confetti from 'canvas-confetti';
import { Title } from './title/title';
import { Ad } from './ad/ad';
import { MainBanner } from './main-banner/main-banner';
import { QuizCallToAction } from './quiz-call-to-action/quiz-call-to-action';
import { WorkshopCard } from './workshop-card/workshop-card';
import { SpotifySection } from './spotify-section/spotify-section';
import { Services } from './services/services';
import { UpcomingProgram } from './upcoming-program/upcoming-program';
import { BlogRecommended } from './blog-recommended/blog-recommended';

@Component({
  selector: 'app-home',
  imports: [
    Title,
    Ad,
    MainBanner,
    QuizCallToAction,
    WorkshopCard,
    SpotifySection,
    Services,
    UpcomingProgram,
    BlogRecommended,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private launchConfetti(): void {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
    });
  }

  ngOnInit(): void {
    let bursts = 0;
    const maxBursts = 4;
    this.launchConfetti();
    const interval = setInterval(() => {
      bursts++;
      this.launchConfetti();
      if (bursts >= maxBursts - 1) clearInterval(interval);
    }, 600);
  }
}
