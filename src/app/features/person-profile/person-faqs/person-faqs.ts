import { Component, Input } from '@angular/core';

interface Faq {
  pregunta: string;
  respuesta: string;
}

@Component({
  selector: 'app-person-faqs',
  templateUrl: './person-faqs.html',
  styleUrl: './person-faqs.scss',
})
export class PersonFAQs {
  @Input() preguntas: Faq[] = [];
  @Input() personColor = '#0d6efd';
}
