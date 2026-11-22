/**
 * Piezas dibujadas de la hamburguesería (SVG propio, ligero):
 * capas de la hamburguesa vistas de lado, la carne vista desde arriba en la
 * plancha y los clientes.
 */
import { cx } from '../../../../../utils/cx.js';

/** Color de la carne según la cocción de una cara (0 cruda → 1.25 carbón). */
export function meatColor(v) {
  const stops = [
    [0, [214, 96, 104]],
    [0.35, [190, 98, 84]],
    [0.6, [150, 84, 52]],
    [0.85, [112, 62, 36]],
    [1.05, [72, 42, 28]],
    [1.25, [34, 26, 24]],
  ];
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i += 1;
  const [a, ca] = stops[i];
  const [b, cb] = stops[i + 1];
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * t));
  return `rgb(${c.join(' ')})`;
}

const DONE_SHADE = { cruda: 0.1, poco: 0.5, perfecta: 0.75, hecha: 0.95, quemada: 1.2 };

/** Una capa vista de lado (ancho 200, alto según el ingrediente). */
export const LAYER_HEIGHT = { 'pan-base': 26, carne: 24, queso: 10, lechuga: 14, tomate: 12, cebolla: 10, pepinillos: 10, bacon: 10, ketchup: 7, mostaza: 7, mayonesa: 7, 'pan-tapa': 46 };

export function Layer({ id, doneness, className, style }) {
  const h = LAYER_HEIGHT[id] ?? 12;
  const body = (() => {
    switch (id) {
      case 'pan-base':
        return (
          <>
            <path d="M14 2 H186 Q192 2 190 10 L184 22 Q182 26 176 26 H24 Q18 26 16 22 L10 10 Q8 2 14 2 Z" fill="#e3a157" />
            <rect x="14" y="2" width="172" height="6" rx="3" fill="#f6d49a" />
          </>
        );
      case 'pan-tapa':
        return (
          <>
            <path d="M10 44 Q8 6 100 3 Q192 6 190 44 Z" fill="#e39a4c" />
            <path d="M24 40 Q22 14 100 10 Q160 12 176 30" fill="none" stroke="#f3c582" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
            {[
              [60, 18],
              [92, 13],
              [128, 17],
              [80, 28],
              [116, 30],
              [150, 26],
              [44, 32],
            ].map(([x, y]) => (
              <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="2.2" fill="#fff4d8" transform={`rotate(-20 ${x} ${y})`} />
            ))}
          </>
        );
      case 'carne':
        return (
          <>
            <rect x="8" y="2" width="184" height="21" rx="10" fill={meatColor(DONE_SHADE[doneness] ?? 0.75)} />
            <path d="M22 9 H178 M30 16 H170" stroke="rgb(0 0 0 / 0.18)" strokeWidth="2" strokeDasharray="10 8" />
          </>
        );
      case 'queso':
        return <path d="M6 1 H194 L190 5 L170 5 L162 10 L154 5 L60 5 L50 10 L42 5 L10 5 Z" fill="#f7c531" stroke="#e2a90f" strokeWidth="1" />;
      case 'lechuga':
        return <path d="M2 7 Q12 0 22 7 T42 7 T62 7 T82 7 T102 7 T122 7 T142 7 T162 7 T182 7 T198 7 Q190 14 100 13 Q10 14 2 7 Z" fill="#5cbf4a" stroke="#3c9a34" strokeWidth="1.5" />;
      case 'tomate':
        return (
          <>
            <rect x="16" y="1" width="80" height="10" rx="5" fill="#e2433a" />
            <rect x="104" y="1" width="80" height="10" rx="5" fill="#e2433a" />
            <path d="M30 6 h50 M118 6 h50" stroke="#ff8a7a" strokeWidth="2" strokeDasharray="4 6" />
          </>
        );
      case 'cebolla':
        return (
          <>
            {[28, 76, 124, 172].map((x) => (
              <ellipse key={x} cx={x} cy="5" rx="22" ry="4" fill="none" stroke="#e8d6ec" strokeWidth="3" />
            ))}
          </>
        );
      case 'pepinillos':
        return (
          <>
            {[34, 82, 130, 172].map((x) => (
              <ellipse key={x} cx={x} cy="5" rx="17" ry="4.5" fill="#7fae3a" stroke="#4f7d20" strokeWidth="1.5" />
            ))}
          </>
        );
      case 'bacon':
        return <path d="M8 5 Q24 0 40 5 T72 5 T104 5 T136 5 T168 5 T196 5 L196 9 Q180 12 168 9 T136 9 T104 9 T72 9 T40 9 T8 9 Z" fill="#c2453f" stroke="#f1a59a" strokeWidth="1.5" />;
      case 'ketchup':
      case 'mostaza':
      case 'mayonesa': {
        const color = { ketchup: '#d8281f', mostaza: '#f0b818', mayonesa: '#fbf3dc' }[id];
        return <path d="M18 3 Q30 7 42 3 T66 3 T90 3 T114 3 T138 3 T162 3 T182 3" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />;
      }
      default:
        return null;
    }
  })();
  return (
    <svg className={cx('bg-layer', className)} style={style} viewBox={`0 0 200 ${h}`} width="200" height={h} aria-hidden="true" focusable="false" data-layer={id}>
      {body}
    </svg>
  );
}

/** Hamburguesa completa (pila de capas). Las capas se solapan un poco, como de verdad. */
export function BurgerStack({ layers, className, animateLast = false }) {
  return (
    <div className={cx('bg-stack', className)}>
      {layers.map((layer, i) => {
        const id = typeof layer === 'string' ? layer : layer.id;
        return (
          <Layer
            key={`${i}-${id}`}
            id={id}
            doneness={typeof layer === 'string' ? undefined : layer.doneness}
            className={animateLast && i === layers.length - 1 ? 'is-dropping' : undefined}
            style={{ '--h': LAYER_HEIGHT[id], zIndex: i + 1 }}
          />
        );
      })}
    </div>
  );
}

/** Carne en la plancha, vista desde arriba: se ve la cara de arriba; el borde delata la de abajo. */
export function PattyTop({ patty, ready, className }) {
  const up = patty.sides[1 - patty.down];
  const down = patty.sides[patty.down];
  return (
    <svg className={cx('bg-patty', ready && 'is-ready', className)} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="52" r="42" fill={meatColor(down)} />
      <circle cx="50" cy="50" r="40" fill={meatColor(up)} />
      {up > 0.3 && <path d="M24 38 L76 38 M20 52 L80 52 M24 66 L76 66" stroke="rgb(40 20 10 / 0.35)" strokeWidth="5" strokeLinecap="round" />}
      <circle cx="36" cy="34" r="5" fill="rgb(255 255 255 / 0.15)" />
    </svg>
  );
}

/** Cliente: un busto sencillo con su color de pelo y camiseta. */
export function Customer({ look, mood = 'ok', className }) {
  const mouth = mood === 'happy' ? 'M40 62 Q50 72 60 62' : mood === 'angry' ? 'M40 68 Q50 60 60 68' : 'M42 65 H58';
  return (
    <svg className={cx('bg-customer', className)} viewBox="0 0 100 120" aria-hidden="true" focusable="false">
      <path d="M12 120 Q14 86 50 84 Q86 86 88 120 Z" fill={look.shirt} />
      <rect x="42" y="72" width="16" height="16" rx="6" fill={look.skin} />
      <circle cx="50" cy="52" r="26" fill={look.skin} />
      <path d="M24 50 Q24 22 50 22 Q78 22 76 50 Q70 36 50 34 Q32 34 24 50 Z" fill={look.hair} />
      <circle cx="41" cy="52" r="3" fill="#2a1d17" />
      <circle cx="59" cy="52" r="3" fill="#2a1d17" />
      {mood === 'angry' && <path d="M35 44 L45 47 M65 44 L55 47" stroke="#2a1d17" strokeWidth="3" strokeLinecap="round" />}
      <path d={mouth} fill="none" stroke="#2a1d17" strokeWidth="3" strokeLinecap="round" />
      <circle cx="35" cy="60" r="4" fill="#ff8a7a" opacity="0.35" />
      <circle cx="65" cy="60" r="4" fill="#ff8a7a" opacity="0.35" />
    </svg>
  );
}
