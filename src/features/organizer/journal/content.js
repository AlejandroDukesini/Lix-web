/**
 * Plantillas y preguntas del diario. Todo es opcional: una entrada puede empezar en
 * blanco, y las preguntas se pueden ocultar desde los ajustes del diario.
 */

export const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-tres-cosas',
    name: 'Tres cosas buenas',
    description: 'Para terminar el día mirando lo que sí salió bien.',
    body: '## Tres cosas buenas de hoy\n\n1. \n2. \n3. \n\n## Por qué importaron\n\n',
  },
  {
    id: 'builtin-recuerdo',
    name: 'Un recuerdo para guardar',
    description: 'Un momento que no quieres olvidar, con sus detalles.',
    body: '## Qué pasó\n\n\n## Dónde y con quién\n\n\n## Un detalle que quiero recordar\n\n',
  },
  {
    id: 'builtin-semana',
    name: 'Mi semana',
    description: 'Un repaso corto de la semana.',
    body: '## Lo mejor de la semana\n\n\n## Lo que me costó\n\n\n## Lo que aprendí\n\n\n## Para la próxima semana\n\n- [ ] \n',
  },
  {
    id: 'builtin-antes-de-dormir',
    name: 'Antes de dormir',
    description: 'Vaciar la cabeza para descansar mejor.',
    body: '## Lo que me quedó dando vueltas\n\n\n## Lo que puede esperar a mañana\n\n- \n\n## Algo que agradezco\n\n',
  },
];

export const PROMPTS = [
  '¿Qué fue lo más bonito de hoy, aunque haya sido pequeño?',
  '¿Qué conversación te quedó sonando?',
  '¿Qué hiciste hoy por primera vez?',
  '¿Qué te hizo reír?',
  '¿Qué te gustaría recordar de este día dentro de un año?',
  '¿Qué aprendiste hoy, dentro o fuera de clase?',
  '¿Con quién te sentiste en casa hoy?',
  '¿Qué te sorprendió?',
  '¿Qué decisión tomaste y por qué?',
  '¿Qué lugar visitaste o qué camino recorriste?',
  '¿Qué te gustaría haber hecho distinto?',
  '¿Qué canción, libro o película te acompañó hoy?',
  '¿Qué te dio energía y qué te la quitó?',
  '¿Qué plan te ilusiona para los próximos días?',
  '¿Qué le dirías a tu yo de hace un año?',
  '¿Qué detalle del día pasarías por alto si no lo escribieras?',
];

/** Una pregunta distinta cada día (estable durante el día). */
export function promptOfDay(isoDate, offset = 0) {
  const n = isoDate.split('-').reduce((sum, part) => sum + Number(part), 0);
  return PROMPTS[(n + offset) % PROMPTS.length];
}
