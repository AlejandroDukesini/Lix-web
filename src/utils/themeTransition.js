/**
 * Cambia tema o estilo con una transición coordinada: durante ~0,45 s todos los
 * elementos animan a la vez fondo, texto, bordes, sombras y rellenos (clase
 * `is-theming` en <html>, ver base.css), así nada cambia a destiempo ni hay
 * destellos blancos o negros. El cambio en sí es inmediato y síncrono (los
 * controles reflejan su nuevo estado al instante). Con movimiento reducido no
 * se añade transición.
 */
const DURATION_MS = 450;
let timer = null;

export function withThemeTransition(apply) {
  const root = document.documentElement;
  if (root.dataset.motion === 'reduced') {
    apply();
    return;
  }
  root.classList.add('is-theming');
  apply();
  clearTimeout(timer);
  timer = setTimeout(() => root.classList.remove('is-theming'), DURATION_MS + 50);
}
