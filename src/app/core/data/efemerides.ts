/**
 * Efemérides relacionadas con los temas de los especialistas, más los días festivos
 * oficiales de México. Solo se marcan en el calendario de Configuración como referencia
 * para planear contenido; no se publican en el sitio.
 *
 * Para agregar una: elige la regla de fecha (día fijo o "n-ésimo día de la semana del mes"),
 * el área y una nota corta de por qué le sirve a Crianza Sana.
 */

export type EfemerideArea =
  | 'Desarrollo y neurodiversidad'
  | 'Lenguaje y aprendizaje'
  | 'Psicología y salud emocional'
  | 'Pediatría y salud'
  | 'Derechos de la infancia'
  | 'Familia y crianza'
  | 'Duelo y acompañamiento'
  | 'Día festivo';

interface FixedRule {
  month: number; // 1-12
  day: number;
}

/** n-ésimo día de la semana del mes (weekday 0 = domingo; n = -1 → el último). */
interface NthWeekdayRule {
  month: number;
  weekday: number;
  n: number;
}

export interface EfemerideDef {
  title: string;
  area: EfemerideArea;
  note: string;
  /** Especialistas a los que les toca el tema (por nombre corto). */
  afines?: string[];
  rule: FixedRule | NthWeekdayRule;
  /** Feriado oficial (Ley Federal del Trabajo, art. 74). */
  official?: boolean;
}

export interface Efemeride extends Omit<EfemerideDef, 'rule'> {
  date: Date;
}

export const EFEMERIDES: EfemerideDef[] = [
  // ---------------- Enero
  { rule: { month: 1, day: 1 }, title: 'Año Nuevo', area: 'Día festivo', official: true, note: 'Día de descanso obligatorio.' },
  { rule: { month: 1, day: 24 }, title: 'Día Internacional de la Educación', area: 'Lenguaje y aprendizaje', note: 'Regreso a clases: hábitos de estudio, apoyo escolar y aprendizaje.', afines: ['Ana Laura', 'Carina'] },

  // ---------------- Febrero
  { rule: { month: 2, weekday: 1, n: 1 }, title: 'Día de la Constitución', area: 'Día festivo', official: true, note: 'Descanso obligatorio (primer lunes de febrero).' },
  { rule: { month: 2, day: 14 }, title: 'Día Internacional de las Cardiopatías Congénitas', area: 'Pediatría y salud', note: 'Detección temprana y acompañamiento de niños con cardiopatías.', afines: ['Miriam'] },
  { rule: { month: 2, day: 15 }, title: 'Día Internacional del Cáncer Infantil', area: 'Pediatría y salud', note: 'Señales de alerta, acompañamiento a familias y duelo.', afines: ['Miriam', 'Martha Elena'] },
  { rule: { month: 2, day: 18 }, title: 'Día Internacional del Síndrome de Asperger', area: 'Desarrollo y neurodiversidad', note: 'Visibilizar el espectro autista y sus distintas formas.', afines: ['Carina', 'Ana Laura'] },
  { rule: { month: 2, day: 21 }, title: 'Día Internacional de la Lengua Materna', area: 'Lenguaje y aprendizaje', note: 'Desarrollo del lenguaje en casa y bilingüismo.', afines: ['Ana Laura'] },

  // ---------------- Marzo
  { rule: { month: 3, day: 3 }, title: 'Día Mundial de la Audición', area: 'Lenguaje y aprendizaje', note: 'La audición como base del lenguaje; tamiz auditivo.', afines: ['Ana Laura', 'Miriam'] },
  { rule: { month: 3, day: 8 }, title: 'Día Internacional de la Mujer', area: 'Familia y crianza', note: 'Maternidad, corresponsabilidad y carga mental en la crianza.', afines: ['Roberto', 'Luis'] },
  { rule: { month: 3, weekday: 1, n: 3 }, title: 'Natalicio de Benito Juárez', area: 'Día festivo', official: true, note: 'Descanso obligatorio (tercer lunes de marzo).' },
  { rule: { month: 3, day: 21 }, title: 'Día Mundial del Síndrome de Down', area: 'Desarrollo y neurodiversidad', note: 'Inclusión, estimulación temprana y terapias.', afines: ['Carina', 'Ana Laura'] },

  // ---------------- Abril
  { rule: { month: 4, day: 2 }, title: 'Día Mundial de Concienciación sobre el Autismo', area: 'Desarrollo y neurodiversidad', note: 'Señales tempranas del TEA, diagnóstico y acompañamiento.', afines: ['Carina', 'Ana Laura', 'Luis'] },
  { rule: { month: 4, day: 7 }, title: 'Día Mundial de la Salud', area: 'Pediatría y salud', note: 'Salud infantil: chequeos, vacunas y prevención.', afines: ['Miriam'] },
  { rule: { month: 4, day: 15 }, title: 'Día Mundial del Arte', area: 'Psicología y salud emocional', note: 'El arte como lenguaje para expresar emociones.', afines: ['Carina'] },
  { rule: { month: 4, day: 23 }, title: 'Día Internacional del Libro', area: 'Lenguaje y aprendizaje', note: 'Lectura en voz alta, gusto por leer y procesos lectores.', afines: ['Ana Laura', 'Carina'] },
  { rule: { month: 4, day: 30 }, title: 'Día del Niño y la Niña', area: 'Familia y crianza', note: 'Fecha fuerte para eventos, juego y derechos de la infancia.', afines: ['Carina', 'Luis', 'Roberto'] },

  // ---------------- Mayo
  { rule: { month: 5, day: 1 }, title: 'Día del Trabajo', area: 'Día festivo', official: true, note: 'Descanso obligatorio.' },
  { rule: { month: 5, day: 10 }, title: 'Día de las Madres', area: 'Familia y crianza', note: 'Maternidad, autocuidado y salud emocional de mamá.', afines: ['Luis', 'Martha Elena'] },
  { rule: { month: 5, day: 15 }, title: 'Día Internacional de las Familias', area: 'Familia y crianza', note: 'Dinámica familiar, límites y derecho familiar. También es Día del Maestro en México.', afines: ['Luis', 'Roberto'] },

  // ---------------- Junio
  { rule: { month: 6, day: 1 }, title: 'Día Mundial de las Madres y los Padres', area: 'Familia y crianza', note: 'Reconocer la crianza compartida (ONU).', afines: ['Luis'] },
  { rule: { month: 6, day: 11 }, title: 'Día Internacional del Juego', area: 'Desarrollo y neurodiversidad', note: 'El juego como motor del desarrollo (ONU).', afines: ['Carina', 'Ana Laura'] },
  { rule: { month: 6, day: 12 }, title: 'Día Mundial contra el Trabajo Infantil', area: 'Derechos de la infancia', note: 'Derechos de niñas y niños; marco legal.', afines: ['Roberto'] },
  { rule: { month: 6, day: 18 }, title: 'Día del Orgullo Autista', area: 'Desarrollo y neurodiversidad', note: 'Neurodiversidad desde la mirada de las propias personas autistas.', afines: ['Carina', 'Ana Laura'] },
  { rule: { month: 6, weekday: 0, n: 3 }, title: 'Día del Padre', area: 'Familia y crianza', note: 'Paternidad presente y corresponsable (tercer domingo de junio).', afines: ['Luis', 'Roberto'] },

  // ---------------- Julio
  { rule: { month: 7, day: 13 }, title: 'Día Internacional del TDAH', area: 'Desarrollo y neurodiversidad', note: 'Entender el TDAH en casa y en la escuela.', afines: ['Carina', 'Ana Laura', 'Luis'] },

  // ---------------- Agosto
  { rule: { month: 8, day: 1 }, title: 'Semana Mundial de la Lactancia Materna (1–7 ago)', area: 'Pediatría y salud', note: 'Lactancia, mitos y apoyo a mamás.', afines: ['Miriam'] },
  { rule: { month: 8, day: 12 }, title: 'Día Internacional de la Juventud', area: 'Psicología y salud emocional', note: 'Adolescencia: emociones, pantallas y comunicación.', afines: ['Luis'] },

  // ---------------- Septiembre
  { rule: { month: 9, day: 8 }, title: 'Día Internacional de la Alfabetización', area: 'Lenguaje y aprendizaje', note: 'Lectoescritura y dificultades de aprendizaje.', afines: ['Ana Laura'] },
  { rule: { month: 9, day: 10 }, title: 'Día Mundial para la Prevención del Suicidio', area: 'Psicología y salud emocional', note: 'Señales de alerta en niños y adolescentes.', afines: ['Luis', 'Martha Elena'] },
  { rule: { month: 9, day: 16 }, title: 'Día de la Independencia', area: 'Día festivo', official: true, note: 'Descanso obligatorio.' },
  { rule: { month: 9, day: 23 }, title: 'Día Internacional de las Lenguas de Señas', area: 'Lenguaje y aprendizaje', note: 'Comunicación aumentativa y alternativa, inclusión.', afines: ['Ana Laura', 'Carina'] },
  { rule: { month: 9, day: 29 }, title: 'Día Mundial del Corazón', area: 'Pediatría y salud', note: 'Corazón sano desde la infancia.', afines: ['Miriam'] },

  // ---------------- Octubre (mes de concienciación del TDAH)
  { rule: { month: 10, day: 6 }, title: 'Día Mundial de la Parálisis Cerebral', area: 'Desarrollo y neurodiversidad', note: 'Terapias, inclusión y apoyo a familias.', afines: ['Carina'] },
  { rule: { month: 10, day: 8 }, title: 'Día Mundial de la Dislexia', area: 'Lenguaje y aprendizaje', note: 'Detectar y acompañar la dislexia.', afines: ['Ana Laura'] },
  { rule: { month: 10, day: 10 }, title: 'Día Mundial de la Salud Mental', area: 'Psicología y salud emocional', note: 'Salud mental infantil y de los cuidadores.', afines: ['Luis'] },
  { rule: { month: 10, day: 15 }, title: 'Día Mundial del Lavado de Manos', area: 'Pediatría y salud', note: 'Prevención de infecciones en casa y escuela.', afines: ['Miriam'] },
  { rule: { month: 10, day: 15 }, title: 'Día de la Muerte Gestacional y Perinatal', area: 'Duelo y acompañamiento', note: 'Acompañar el duelo perinatal.', afines: ['Martha Elena'] },
  { rule: { month: 10, day: 16 }, title: 'Día Mundial de la Alimentación', area: 'Pediatría y salud', note: 'Alimentación infantil y hábitos en familia.', afines: ['Miriam'] },
  { rule: { month: 10, day: 22 }, title: 'Día Internacional de la Tartamudez', area: 'Lenguaje y aprendizaje', note: 'Cómo acompañar a un niño que tartamudea.', afines: ['Ana Laura'] },

  // ---------------- Noviembre
  { rule: { month: 11, day: 2 }, title: 'Día de Muertos', area: 'Duelo y acompañamiento', note: 'Cómo hablar de la muerte con niñas y niños.', afines: ['Martha Elena', 'Luis'] },
  { rule: { month: 11, day: 14 }, title: 'Día Mundial de la Diabetes', area: 'Pediatría y salud', note: 'Diabetes tipo 1 en la infancia y prevención.', afines: ['Miriam'] },
  { rule: { month: 11, day: 17 }, title: 'Día Mundial de la Prematuridad', area: 'Pediatría y salud', note: 'Cuidados y seguimiento del bebé prematuro.', afines: ['Miriam', 'Carina'] },
  { rule: { month: 11, weekday: 1, n: 3 }, title: 'Día de la Revolución', area: 'Día festivo', official: true, note: 'Descanso obligatorio (tercer lunes de noviembre).' },
  { rule: { month: 11, day: 19 }, title: 'Día Mundial para la Prevención del Abuso Sexual Infantil', area: 'Derechos de la infancia', note: 'Prevención, señales y qué hacer legalmente.', afines: ['Roberto', 'Luis'] },
  { rule: { month: 11, day: 20 }, title: 'Día Universal del Niño', area: 'Derechos de la infancia', note: 'Aniversario de la Convención sobre los Derechos del Niño.', afines: ['Roberto', 'Carina'] },
  { rule: { month: 11, day: 25 }, title: 'Día para la Eliminación de la Violencia contra la Mujer', area: 'Derechos de la infancia', note: 'Violencia familiar y su impacto en la infancia.', afines: ['Roberto', 'Luis'] },

  // ---------------- Diciembre
  { rule: { month: 12, day: 3 }, title: 'Día Internacional de las Personas con Discapacidad', area: 'Desarrollo y neurodiversidad', note: 'Inclusión escolar y social.', afines: ['Carina', 'Ana Laura'] },
  { rule: { month: 12, day: 25 }, title: 'Navidad', area: 'Día festivo', official: true, note: 'Descanso obligatorio.' },
];

function resolveDate(rule: FixedRule | NthWeekdayRule, year: number): Date {
  if ('day' in rule) return new Date(year, rule.month - 1, rule.day);
  if (rule.n > 0) {
    const first = new Date(year, rule.month - 1, 1);
    const offset = (rule.weekday - first.getDay() + 7) % 7;
    return new Date(year, rule.month - 1, 1 + offset + (rule.n - 1) * 7);
  }
  const last = new Date(year, rule.month, 0);
  const offset = (last.getDay() - rule.weekday + 7) % 7;
  return new Date(year, rule.month - 1, last.getDate() - offset);
}

/** Efemérides entre dos fechas (inclusive), resolviendo las reglas año por año. */
export function efemeridesBetween(start: Date, end: Date): Efemeride[] {
  const result: Efemeride[] = [];
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    for (const { rule, ...def } of EFEMERIDES) {
      const date = resolveDate(rule, year);
      if (date >= start && date <= end) result.push({ ...def, date });
    }
  }
  return result;
}
