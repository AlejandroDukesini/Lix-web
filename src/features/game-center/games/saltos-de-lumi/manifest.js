import { LumiArt } from './LumiArt.jsx';
import { LEVELS } from './levels/levels.js';

export const saltosDeLumiManifest = {
  id: 'saltos-de-lumi',
  phase: 3,
  title: 'Saltos de Lumi',
  tagline: 'Plataformas originales: una chispa de luz en busca de su vela.',
  description: `Lumi es una chispita de luz. Corre, salta, pisa sombras y esquiva polillas y zarzas para llegar a la vela de cada nivel. ${LEVELS.length} niveles originales, de la pradera al atardecer a una noche estrellada.`,
  categories: ['clasicos', 'aventura', 'habilidad'],
  Art: LumiArt,
  palette: { a: '#ffc35a', b: '#7a4a78' },
  facts: [`${LEVELS.length} niveles originales`, 'Faroles de control', 'Mejor tiempo y chispas por nivel'],
  objective: 'Llegar a la vela del final de cada nivel. Recoger todas las chispas es opcional; el mejor tiempo queda guardado.',
  howTo: [
    'Corre a izquierda y derecha y salta. Mantén el salto para llegar más alto; suéltalo pronto para un salto corto.',
    'Cae sobre las sombras para eliminarlas. Tocarlas de lado, las polillas, las zarzas o caer al vacío cuesta una vida.',
    'Los faroles se encienden al pasar: si pierdes una vida, vuelves al último encendido. Con 3 vidas perdidas se reinicia el nivel.',
    'Las plataformas finas se atraviesan desde abajo; las de madera clara se mueven; los muelles te lanzan muy alto.',
  ],
  controls: {
    keyboard: [
      ['← → o A D', 'Moverse'],
      ['Espacio, ↑ o W', 'Saltar (mantener: más alto)'],
      ['R · Esc o P', 'Reiniciar · Pausa'],
    ],
    touch: [
      ['Almohadilla izquierda', 'Moverse (desliza el pulgar de ‹ a ›)'],
      ['Botón redondo derecho', 'Saltar (mantener: más alto)'],
      ['Dos dedos', 'Correr y saltar a la vez'],
    ],
  },
  difficulty: 'De saltos sencillos a plataformas móviles, cuevas de techo bajo y nubes sobre el vacío.',
  load: () => import('./SaltosDeLumi.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} niveles` };
  },
  highlight(record) {
    const coins = Object.values(record?.progress?.coins ?? {}).reduce((a, b) => a + b, 0);
    return coins ? `${coins} chispas recogidas` : null;
  },
};
