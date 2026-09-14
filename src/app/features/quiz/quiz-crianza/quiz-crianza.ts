import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface Category {
  id: string;
  name: string;
  emoji: string;
  questions: string[];
  resultMessage: string;
  contactPhone: string | null;
  contactName: string;
  ctaText?: string;
  ctaLink?: string;
  logo?: string | null;
  image?: string | null;
}

interface FlattenedQuestion {
  text: string;
  categoryId: string;
}

const CATEGORIES: Category[] = [
  {
    id: 'pediatria',
    name: 'Pediatría / Cardiología',
    emoji: '🩺',
    questions: [
      '¿Se enferma seguido de gripa, tos, garganta o estómago y tarda mucho en recuperarse?',
      '¿Lo notas más cansado de lo normal, con poco apetito o cambios en su sueño/energía?',
      '¿Sientes que algo “no te cuadra” en su salud, aunque no sepas explicar exactamente qué?',
    ],
    resultMessage:
      'Podría necesitar una valoración pediátrica general. Un chequeo oportuno ayuda a detectar a tiempo pequeños problemas antes de que se vuelvan grandes.',
    contactPhone: '526183711950',
    contactName: 'Miriam Cervantes Huerta',
    ctaText: 'Agenda su revisión pediátrica',
  },
  {
    id: 'psicologia',
    name: 'Psicología Infantil',
    emoji: '❤️',
    questions: [
      '¿Tu hijo tiene berrinches intensos o explosiones emocionales frecuentes?',
      '¿Le cuesta expresar lo que siente con palabras?',
      '¿Notas ansiedad, miedo, irritabilidad o cambios fuertes de ánimo?',
    ],
    resultMessage:
      'Tu hijo podría beneficiarse de acompañamiento emocional. Un psicólogo infantil puede ayudarle a regular sus emociones, mejorar su conducta y fortalecer su seguridad.',
    contactPhone: '526181875036',
    contactName: 'Saraid Chávez',
  },
  {
    id: 'nutricion',
    name: 'Nutrición',
    emoji: '🍎',
    questions: [
      '¿Es muy selectivo con la comida o rechaza muchos alimentos?',
      '¿Las comidas se convierten en pelea o estrés diario?',
      '¿Tiene cambios de peso, estreñimiento o malestar frecuente?',
    ],
    resultMessage:
      'Podría beneficiarse de orientación nutricional. Un plan adecuado mejora energía, crecimiento y hábitos saludables.',
    contactPhone: '526182692637',
    contactName: 'Silvia Andrea Soria Díaz',
    ctaText: 'Agenda consulta nutricional',
  },
  {
    id: 'lenguaje',
    name: 'Lenguaje / Comunicación',
    emoji: '👅',
    questions: [
      '¿Le cuesta pronunciar palabras o solo la familia le entiende?',
      '¿Se frustra o evita hablar cuando quiere pedir algo?',
      '¿Comparado con niños de su edad, habla menos o forma frases cortas?',
    ],
    resultMessage: 'La terapia de lenguaje fortalece su expresión y confianza al comunicarse.',
    contactPhone: '526181072514',
    contactName: 'Ana Laura Sosa Nevárez',
    image: null,
    ctaText: 'Agenda evaluación de lenguaje',
  },
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    emoji: '🤸',
    questions: [
      '¿Se cae con frecuencia o parece torpe al correr/brincar?',
      '¿Se cansa rápido o evita actividades físicas?',
      '¿Notas mala postura o dificultad para coordinar movimientos?',
    ],
    resultMessage:
      'Puede requerir apoyo en desarrollo motor. La fisioterapia pediátrica mejora fuerza, equilibrio y coordinación.',
    contactPhone: '526181682977',
    contactName: 'Karen Meraz Cardosa',
    ctaText: 'Agenda valoración física',
  },
  {
    id: 'odontopediatria',
    name: 'Odontopediatría',
    emoji: '🦷',
    questions: [
      '¿Evita masticar por dolor o sensibilidad?',
      '¿Notas caries, manchas o sangrado al cepillarse?',
      '¿Nunca ha tenido su primera revisión dental?',
    ],
    resultMessage: 'Necesita valoración dental infantil. Cuidar los dientes de leche previene problemas futuros.',
    contactPhone: '526181515530',
    contactName: 'Patricia Peña Raigosa',
    ctaText: 'Agenda consulta odontológica',
  },
  {
    id: 'tcc',
    name: 'Terapia Cognitivo-Conductual',
    emoji: '🧠',
    questions: [
      '¿Tu hijo se preocupa demasiado, piensa “lo peor” o se angustia por cosas pequeñas?',
      '¿Evita situaciones por miedo, inseguridad o vergüenza?',
      '¿Notas conductas repetitivas o difíciles de cambiar como enojo constante o baja autoestima?',
    ],
    resultMessage:
      'Tu hijo podría beneficiarse de Terapia Cognitivo-Conductual. Esta terapia le ayuda a entender lo que piensa y cambiar conductas.',
    contactPhone: '526188409000',
    contactName: 'Luis A. Galván Solís',
    ctaText: 'Agenda valoración terapéutica',
  },
  {
    id: 'legal',
    name: 'Orientación Legal Familiar',
    emoji: '⚖️',
    questions: [
      '¿Estás pasando por separación o conflicto y no sabes cómo organizar lo legal?',
      '¿Tienes dudas sobre pensión, convivencias o permisos escolares?',
      '¿Han hecho acuerdos sobre tu hijo, pero la otra parte no los respeta?',
    ],
    resultMessage: 'Podría ayudarte una orientación legal familiar. Recibir asesoría te da claridad y respaldo legal.',
    contactPhone: '526181222244',
    contactName: 'Roberto Bravo Romo',
    ctaText: 'Agendar orientación familiar',
  },
];

@Component({
  selector: 'app-quiz-crianza',
  imports: [RouterLink],
  templateUrl: './quiz-crianza.html',
  styleUrl: './quiz-crianza.scss',
})
export class QuizCrianza implements OnInit {
  private readonly route = inject(ActivatedRoute);

  readonly categories = CATEGORIES;

  readonly step = signal(0);
  readonly currentQuestionIdx = signal(0);
  readonly answers = signal<Record<string, number>>({});
  readonly finalResult = signal<Category | null>(null);
  readonly selectedCategory = signal<Category | null>(null);
  readonly showToast = signal(false);

  private startDate: Date | null = null;
  private flattenedQuestions: FlattenedQuestion[] = [];

  readonly currentQuestion = computed(() => {
    const q = this.flattenedQuestions[this.currentQuestionIdx()];
    return q ? q.text : '';
  });

  readonly progressPercentage = computed(() => {
    if (this.flattenedQuestions.length === 0) return 0;
    return (this.currentQuestionIdx() / this.flattenedQuestions.length) * 100;
  });

  readonly whatsappLink = computed(() => {
    const result = this.finalResult();
    if (!result) return '#';
    const message = `Hola, realicé el test de Crianza Sana y me gustaría agendar una cita para el área de ${result.name}.`;
    return `https://wa.me/${result.contactPhone}?text=${encodeURIComponent(message)}`;
  });

  ngOnInit(): void {
    this.initSchedule();

    setTimeout(() => {
      const catId = this.route.snapshot.queryParamMap.get('cat');
      if (catId) {
        const index = this.categories.findIndex((c) => c.id === catId);
        if (index !== -1) {
          if (this.isUnlocked(index)) {
            this.startQuiz(this.categories[index], index);
          } else {
            console.log('Categoría bloqueada o no disponible aún');
          }
        }
      }
    }, 500);
  }

  private initSchedule(): void {
    this.startDate = new Date('2026-02-05T00:00:00');
  }

  private daysPassed(): number {
    if (!this.startDate) return 0;
    const now = new Date();
    const diff = now.getTime() - this.startDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  isUnlocked(index: number): boolean {
    const dp = this.daysPassed();
    if (dp < 0) return false;
    return dp >= index * 2;
  }

  getUnlockDate(index: number): string {
    if (!this.startDate) return '';
    const unlockDate = new Date(this.startDate);
    unlockDate.setDate(unlockDate.getDate() + index * 2);
    return unlockDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  startQuiz(categoryData: Category, index: number): void {
    if (!this.isUnlocked(index)) return;

    this.selectedCategory.set(categoryData);
    this.step.set(1);
    this.currentQuestionIdx.set(0);
    this.answers.set({});
    this.prepareQuestions(categoryData);
  }

  private prepareQuestions(categoryData: Category): void {
    this.flattenedQuestions = categoryData.questions.map((text) => ({ text, categoryId: categoryData.id }));
    this.flattenedQuestions.sort(() => 0.5 - Math.random());
  }

  handleAnswer(value: 'si' | 'a_veces' | 'no'): void {
    const currentQ = this.flattenedQuestions[this.currentQuestionIdx()];

    if (value === 'si') {
      this.answers.update((a) => ({ ...a, [currentQ.categoryId]: (a[currentQ.categoryId] || 0) + 1 }));
    } else if (value === 'a_veces') {
      this.answers.update((a) => ({ ...a, [currentQ.categoryId]: (a[currentQ.categoryId] || 0) + 0.5 }));
    }

    this.nextQuestion();
  }

  prevQuestion(): void {
    if (this.currentQuestionIdx() > 0) {
      this.currentQuestionIdx.update((i) => i - 1);
    }
  }

  private nextQuestion(): void {
    if (this.currentQuestionIdx() < this.flattenedQuestions.length - 1) {
      this.currentQuestionIdx.update((i) => i + 1);
    } else {
      this.calculateResult();
    }
  }

  private calculateResult(): void {
    const cat = this.selectedCategory();
    if (!cat) return;
    const score = this.answers()[cat.id] || 0;

    if (score < 2) {
      this.finalResult.set({
        id: cat.id,
        name: '¡Excelente!',
        emoji: '💛',
        questions: [],
        resultMessage:
          'Tu hijo va por buen camino 💛. Si quieres seguir fortaleciendo su desarrollo, te invitamos a seguir nuestro contenido y aprender herramientas prácticas para acompañarlo mejor.',
        ctaText: 'Ver contenido educativo',
        ctaLink: '/blog',
        contactPhone: null,
        contactName: 'Crianza Sana By D-Kids',
        logo: null,
        image: null,
      });
    } else {
      this.finalResult.set(cat);
    }

    this.step.set(2);
  }

  resetQuiz(): void {
    this.step.set(0);
    this.finalResult.set(null);
    this.answers.set({});
    this.currentQuestionIdx.set(0);
    this.selectedCategory.set(null);
  }

  shareLink(catId: string | undefined): void {
    const url = `${window.location.origin}${window.location.pathname}?cat=${catId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
      })
      .catch((err) => console.error('Error al copiar', err));
  }

  shareFacebook(catId: string | undefined): void {
    const backendUrl = 'https://backend-crianza-sana-production.up.railway.app';
    const shareUrl = encodeURIComponent(`${backendUrl}/quiz?cat=${catId}`);
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
    window.open(facebookShareUrl, 'facebook-share-dialog', 'width=626,height=436');
  }
}
