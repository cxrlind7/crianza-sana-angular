import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { QuizCrianza } from './quiz-crianza/quiz-crianza';

@Component({
  selector: 'app-quiz',
  imports: [QuizCrianza],
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss',
})
export class Quiz {
  private readonly router = inject(Router);

  goBack(): void {
    this.router.navigate(['/']);
  }
}
