/**
 * Dibujos (SVG) de lo que se prepara. Reciben la misma estructura que el pedido,
 * así sirven para el banco de trabajo (lo que llevas) y para la comanda (lo que
 * piden). Son decorativos: el texto de la comanda y del resultado describe lo mismo.
 *
 * Estilo: ilustración de recetario con volumen. Cada ingrediente lleva su luz
 * (degradados), textura (barquillo en rejilla, miga, corteza tostada, queso
 * fundido) y sombra de contacto. Los identificadores de los degradados son
 * únicos por dibujo (useId): la comanda y el banco pueden convivir en pantalla.
 */
import { useId } from 'react';
import { HELADERIA, PASTELERIA, PIZZERIA } from '../recipes/recipes.js';
import { zoneOf } from '../engine/orders.js';

const colorOf = (recipe, stepId, id) => recipe.steps.find((s) => s.id === stepId)?.options.find((o) => o.id === id)?.color ?? '#cccccc';

/** Posiciones pseudoaleatorias fijas (mismo ingrediente → mismo dibujo). */
function scatter(seedText, n) {
  let s = [...seedText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: n }, () => ({ a: rand() * Math.PI * 2, r: Math.sqrt(rand()), rot: rand() * 360 }));
}

/** Mezcla un color hex con otro (k = 0 → a, 1 → b). Devuelve hex: se puede volver a mezclar. */
function mix(hex, toward, k) {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
const light = (hex, k = 0.35) => mix(hex, '#ffffff', k);
const dark = (hex, k = 0.25) => mix(hex, '#000000', k);

// ------------------------------------------------------------------- Helado
export function IceCreamVisual({ spec = {}, className, title, bakeValue: _unused, ...rest }) {
  const uid = useId().replace(/:/g, '');
  const scoops = spec.bolas ?? [];
  const container = spec.recipiente;
  const top = 150 - Math.max(0, scoops.length - 1) * 30;
  const topY = scoops.length ? top : 150;
  const toppings = spec.toppings ?? [];
  const coneColor = container && container !== 'tarrina' ? colorOf(HELADERIA, 'recipiente', container) : '#e2a65c';
  return (
    <svg className={className} viewBox="0 0 200 250" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'} {...rest}>
      <defs>
        <pattern id={`waffle${uid}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" fill={coneColor} />
          <path d="M0 0 H12 M0 0 V12" stroke={dark(coneColor, 0.3)} strokeWidth="2.2" />
          <rect x="2" y="2" width="5" height="5" fill={light(coneColor, 0.18)} />
        </pattern>
        <linearGradient id={`coneShade${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={`cup${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f1ecff" />
          <stop offset="1" stopColor="#cfc4ef" />
        </linearGradient>
        {scoops.map((id, i) => {
          const c = colorOf(HELADERIA, 'bolas', id);
          return (
            <radialGradient key={i} id={`scoop${uid}${i}`} cx="0.38" cy="0.32" r="0.75">
              <stop offset="0" stopColor={light(c, 0.45)} />
              <stop offset="0.55" stopColor={c} />
              <stop offset="1" stopColor={dark(c, 0.22)} />
            </radialGradient>
          );
        })}
      </defs>
      <ellipse cx="100" cy="242" rx="56" ry="6" fill="#000" opacity="0.18" />
      {/* Recipiente */}
      {container === 'tarrina' ? (
        <g>
          <path d="M50 168 L150 168 L137 236 Q100 242 63 236 Z" fill={`url(#cup${uid})`} stroke="#b9adea" strokeWidth="2" />
          {[64, 84, 104, 124].map((x) => (
            <path key={x} d={`M${x} 172 L${x + 3} 232`} stroke="#ff9fc6" strokeWidth="5" strokeOpacity="0.55" />
          ))}
          <ellipse cx="100" cy="169" rx="51" ry="7" fill="#ffffff" stroke="#b9adea" strokeWidth="2" />
          <path d="M56 186 L144 186" stroke="#ff6fa8" strokeWidth="4" />
        </g>
      ) : container ? (
        <g>
          <path d="M58 166 L142 166 L100 242 Z" fill={`url(#waffle${uid})`} />
          <path d="M58 166 L142 166 L100 242 Z" fill={`url(#coneShade${uid})`} />
          <path d="M58 166 L142 166 L100 242 Z" fill="none" stroke={dark(coneColor, 0.35)} strokeWidth="2" strokeLinejoin="round" />
          <rect x="55" y="160" width="90" height="12" rx="6" fill={light(coneColor, 0.1)} stroke={dark(coneColor, 0.3)} strokeWidth="1.5" />
        </g>
      ) : (
        <path d="M60 168 L140 168 L100 240 Z" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />
      )}
      {/* Bolas, de abajo arriba: falda rizada, textura y brillo */}
      {scoops.map((id, i) => {
        const cy = 150 - i * 30;
        const c = colorOf(HELADERIA, 'bolas', id);
        return (
          <g key={i}>
            <path d={`M62 ${cy + 8} q7 14 15 4 q8 14 15 2 q8 14 16 2 q8 14 15 -2 q8 12 15 -6 L138 ${cy} Z`} fill={dark(c, 0.12)} />
            <circle cx="100" cy={cy} r="37" fill={`url(#scoop${uid}${i})`} />
            {scatter(`bola-${id}-${i}`, 7).map((p, k) => (
              <circle key={k} cx={100 + Math.cos(p.a) * p.r * 26} cy={cy + 6 + Math.sin(p.a) * p.r * 18} r={1.4 + (k % 3) * 0.6} fill={dark(c, 0.18)} opacity="0.45" />
            ))}
            <path d={`M70 ${cy - 6} q10 -24 34 -26`} stroke="#fff" strokeOpacity="0.55" strokeWidth="5" fill="none" strokeLinecap="round" />
            <ellipse cx="86" cy={cy - 16} rx="7" ry="4" fill="#fff" opacity="0.6" />
          </g>
        );
      })}
      {/* Salsa sobre la bola de arriba, con gotas y brillo */}
      {scoops.length > 0 && spec.salsa && spec.salsa !== 'ninguna' && (
        <g>
          <path
            d={`M64 ${topY - 10} Q100 ${topY - 54} 136 ${topY - 10} q-3 18 -8 4 q-4 26 -11 4 q-6 22 -12 0 q-6 14 -12 -2 q-6 26 -12 2 q-5 16 -11 2 q-4 12 -8 -2 z`}
            fill={colorOf(HELADERIA, 'salsa', spec.salsa)}
            opacity="0.95"
          />
          <path d={`M78 ${topY - 26} q18 -16 40 -10`} stroke="#fff" strokeOpacity="0.5" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )}
      {scoops.length > 0 && toppings.includes('chispas') &&
        scatter('chispas', 14).map((p, i) => (
          <rect key={i} x={100 + Math.cos(p.a) * p.r * 26} y={topY - 14 + Math.sin(p.a) * p.r * 14} width="7" height="2.6" rx="1.3" fill={['#ff6fb1', '#6fd3ff', '#ffe066', '#8affb0'][i % 4]} transform={`rotate(${p.rot} ${100 + Math.cos(p.a) * p.r * 26} ${topY - 14 + Math.sin(p.a) * p.r * 14})`} />
        ))}
      {scoops.length > 0 && toppings.includes('nueces') &&
        scatter('nueces', 6).map((p, i) => (
          <g key={i}>
            <ellipse cx={100 + Math.cos(p.a) * p.r * 24} cy={topY - 10 + Math.sin(p.a) * p.r * 12} rx="5.5" ry="3.8" fill="#a86b3c" stroke="#6e3f1c" strokeWidth="1" />
            <path d={`M${96 + Math.cos(p.a) * p.r * 24} ${topY - 10 + Math.sin(p.a) * p.r * 12} h8`} stroke="#6e3f1c" strokeWidth="0.8" />
          </g>
        ))}
      {scoops.length > 0 && toppings.includes('galleta') && (
        <g transform={`rotate(18 120 ${topY - 33})`}>
          <rect x="112" y={topY - 50} width="16" height="34" rx="3" fill="#c98d4a" stroke="#8a5a26" strokeWidth="1.2" />
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={116 + k * 4} cy={topY - 42 + k * 8} r="1.3" fill="#6b3d17" />
          ))}
        </g>
      )}
      {scoops.length > 0 && toppings.includes('barquillo') && (
        <g transform={`rotate(-20 73 ${topY - 34})`}>
          <rect x="70" y={topY - 56} width="8" height="44" rx="3" fill="#f0c27a" stroke="#b9853a" strokeWidth="1.2" />
          <path d={`M70 ${topY - 50} l8 6 M70 ${topY - 40} l8 6 M70 ${topY - 30} l8 6`} stroke="#b9853a" strokeWidth="1" />
        </g>
      )}
      {scoops.length > 0 && toppings.includes('cereza') && (
        <g>
          <path d={`M100 ${topY - 44} q6 -14 16 -18`} stroke="#3b7a2a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="100" cy={topY - 38} r="9.5" fill="#d10f2c" />
          <circle cx="102" cy={topY - 36} r="7" fill="#e8213f" />
          <circle cx="96.5" cy={topY - 41.5} r="2.6" fill="#fff" opacity="0.75" />
        </g>
      )}
    </svg>
  );
}

// ------------------------------------------------------------------- Pizza
const PIZZA_R = { pequena: 64, mediana: 80, grande: 96 };
const BAKE_TINT = { cruda: 0, poco: 0.15, media: 0.32, bien: 0.5, quemada: 0.85 };

function Topping({ id, x, y, rot }) {
  switch (id) {
    case 'pepperoni':
      return (
        <g>
          <circle cx={x + 1} cy={y + 1.5} r="8.5" fill="#000" opacity="0.18" />
          <circle cx={x} cy={y} r="8.5" fill="#b8242a" stroke="#7d1418" strokeWidth="1.5" />
          <circle cx={x - 2.5} cy={y - 2} r="1.5" fill="#e86a5a" />
          <circle cx={x + 3} cy={y + 2} r="1.2" fill="#e86a5a" />
          <circle cx={x + 1} cy={y - 3.5} r="1" fill="#e86a5a" />
        </g>
      );
    case 'champinones':
      return (
        <g transform={`rotate(${rot} ${x} ${y})`}>
          <path d={`M${x - 7.5} ${y} a7.5 6.5 0 0 1 15 0 z`} fill="#e3d3bc" stroke="#9a8670" strokeWidth="1" />
          <path d={`M${x - 2.5} ${y} h5 v6 h-5 z`} fill="#f1e6d6" stroke="#9a8670" strokeWidth="1" />
          <path d={`M${x - 5} ${y - 1} q5 -3 10 0`} stroke="#b8a487" strokeWidth="0.8" fill="none" />
        </g>
      );
    case 'aceitunas':
      return (
        <g>
          <circle cx={x} cy={y} r="5" fill="none" stroke="#1d1d1d" strokeWidth="3.4" />
          <path d={`M${x - 3} ${y - 3} a4 4 0 0 1 4 -1.5`} stroke="#777" strokeWidth="1" fill="none" />
        </g>
      );
    case 'pimiento':
      return (
        <g transform={`rotate(${rot} ${x} ${y})`}>
          <path d={`M${x - 7} ${y} q7 -9 14 0`} fill="none" stroke="#2c8a3a" strokeWidth="4" strokeLinecap="round" />
          <path d={`M${x - 5} ${y - 2} q5 -5 9 -1`} fill="none" stroke="#7fd68a" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'cebolla':
      return <path d={`M${x - 6} ${y + 3} a6 6 0 0 1 12 0`} fill="none" stroke="#d6aee3" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${rot} ${x} ${y})`} />;
    case 'jamon':
      return (
        <g transform={`rotate(${rot} ${x} ${y})`}>
          <rect x={x - 6.5} y={y - 5} width="13" height="10" rx="2.5" fill="#f19aa6" stroke="#c96d7c" strokeWidth="1" />
          <path d={`M${x - 4} ${y - 1} h8`} stroke="#fff" strokeOpacity="0.6" strokeWidth="1.4" />
        </g>
      );
    case 'pina':
      return (
        <g transform={`rotate(${rot} ${x} ${y})`}>
          <path d={`M${x} ${y - 6.5} l6.5 11 h-13 z`} fill="#ffd84d" stroke="#d0a01c" strokeWidth="1" strokeLinejoin="round" />
          <path d={`M${x} ${y - 2} v5`} stroke="#d0a01c" strokeWidth="0.8" />
        </g>
      );
    case 'albahaca':
      return (
        <g transform={`rotate(${rot} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="7.5" ry="3.8" fill="#2f7d32" />
          <path d={`M${x - 6} ${y} h12`} stroke="#79c27c" strokeWidth="0.9" />
        </g>
      );
    default:
      return null;
  }
}

export function PizzaVisual({ spec = {}, bakeValue, className, title, ...rest }) {
  const uid = useId().replace(/:/g, '');
  const r = PIZZA_R[spec.tamano] ?? 80;
  const cx = 110;
  const cy = 110;
  const zone = bakeValue !== undefined ? zoneOf(bakeValue) : (spec.coccion ?? null);
  const tint = zone ? BAKE_TINT[zone] : 0;
  const doughBase = colorOf(PIZZERIA, 'masa', spec.masa ?? 'clasica');
  const dough = mix(doughBase, '#3a1d0c', tint);
  const sauce = spec.salsa ? colorOf(PIZZERIA, 'salsa', spec.salsa) : null;
  const cheese = spec.queso && spec.queso !== 'sin' ? colorOf(PIZZERIA, 'queso', spec.queso) : null;
  const items = spec.ingredientes ?? [];
  const n = (spec.tamano === 'grande' ? 9 : spec.tamano === 'pequena' ? 5 : 7) + (spec.queso === 'doble' ? 4 : 0);
  const thin = spec.masa === 'fina';
  return (
    <svg className={className} viewBox="0 0 220 220" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'} {...rest}>
      <defs>
        <radialGradient id={`board${uid}`} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#d9a873" />
          <stop offset="1" stopColor="#a8703f" />
        </radialGradient>
        <radialGradient id={`crust${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.78" stopColor={light(dough, 0.15)} />
          <stop offset="0.92" stopColor={dough} />
          <stop offset="1" stopColor={dark(dough, 0.22)} />
        </radialGradient>
        {cheese && (
          <radialGradient id={`cheese${uid}`} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor={light(mix(cheese, '#b5651d', tint * 0.6), 0.35)} />
            <stop offset="1" stopColor={mix(cheese, '#b5651d', tint * 0.6)} />
          </radialGradient>
        )}
      </defs>
      {/* Pala de madera con vetas */}
      <rect x="100" y="196" width="20" height="24" rx="6" fill="#a8703f" />
      <circle cx={cx} cy={cy} r="106" fill={`url(#board${uid})`} />
      {[30, 52, 74].map((d) => (
        <path key={d} d={`M${cx - 96} ${cy - 40 + d} q96 ${d % 2 ? 10 : -10} 192 0`} stroke="#8a5a2c" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
      ))}
      <circle cx={cx} cy={cy} r="106" fill="none" stroke="#7d4f25" strokeOpacity="0.5" strokeWidth="2" />
      {spec.tamano ? (
        <>
          <circle cx={cx + 3} cy={cy + 5} r={r} fill="#000" opacity="0.2" />
          <circle cx={cx} cy={cy} r={r} fill={`url(#crust${uid})`} />
          {/* Burbujas tostadas de la corteza */}
          {scatter(`corteza-${spec.tamano}`, 10).map((p, i) => (
            <circle key={i} cx={cx + Math.cos(p.a) * (r - (thin ? 3 : 6))} cy={cy + Math.sin(p.a) * (r - (thin ? 3 : 6))} r={thin ? 1.6 : 2.6} fill={dark(dough, 0.3 + tint * 0.3)} opacity="0.55" />
          ))}
          {sauce && (
            <>
              <circle cx={cx} cy={cy} r={r - (thin ? 6 : 12)} fill={mix(sauce, '#3a1d0c', tint * 0.5)} />
              <circle cx={cx} cy={cy} r={r - (thin ? 6 : 12)} fill="none" stroke={dark(sauce, 0.2)} strokeWidth="2" opacity="0.5" />
            </>
          )}
          {cheese &&
            scatter(`queso-${spec.queso}`, n).map((p, i) => {
              const qx = cx + Math.cos(p.a) * p.r * (r - 24);
              const qy = cy + Math.sin(p.a) * p.r * (r - 24);
              const qr = spec.queso === 'doble' ? 15 : 12;
              return (
                <g key={i}>
                  <path
                    d={`M${qx - qr} ${qy} q${qr * 0.2} ${-qr} ${qr} ${-qr} q${qr} 0 ${qr} ${qr} q0 ${qr * 0.9} ${-qr} ${qr * 0.9} q${-qr * 1.1} 0 ${-qr} ${-qr * 0.9} z`}
                    fill={`url(#cheese${uid})`}
                    opacity="0.95"
                    transform={`rotate(${p.rot} ${qx} ${qy})`}
                  />
                  <ellipse cx={qx - qr * 0.3} cy={qy - qr * 0.35} rx={qr * 0.3} ry={qr * 0.15} fill="#fff" opacity="0.4" />
                </g>
              );
            })}
          {items.map(({ id, place }) =>
            scatter(id, place === 'toda' ? 8 : 4).map((p, i) => {
              let angle = p.a;
              if (place === 'izq') angle = Math.PI / 2 + (p.a / (Math.PI * 2)) * Math.PI;
              if (place === 'der') angle = -Math.PI / 2 + (p.a / (Math.PI * 2)) * Math.PI;
              const dist = (0.25 + p.r * 0.75) * (r - 22);
              return <Topping key={`${id}-${i}`} id={id} x={cx + Math.cos(angle) * dist} y={cy + Math.sin(angle) * dist} rot={p.rot} />;
            }),
          )}
          {items.some((i) => i.place !== 'toda') && <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#fff" strokeOpacity="0.4" strokeDasharray="4 5" />}
          {zone === 'quemada' && <circle cx={cx} cy={cy} r={r} fill="#1a0a04" opacity="0.35" />}
        </>
      ) : (
        <circle cx={cx} cy={cy} r="80" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="6 6" />
      )}
    </svg>
  );
}

// ------------------------------------------------------------------- Pastel
function topFace(shape, x, y, w) {
  const h = w * 0.32;
  if (shape === 'cuadrado') return `M${x - w / 2 + 14} ${y - h / 2} L${x + w / 2} ${y - h / 2} L${x + w / 2 - 14} ${y + h / 2} L${x - w / 2} ${y + h / 2} Z`;
  if (shape === 'corazon')
    return `M${x} ${y + h / 2} C${x - w * 0.62} ${y + h * 0.05} ${x - w * 0.42} ${y - h * 0.95} ${x} ${y - h * 0.3} C${x + w * 0.42} ${y - h * 0.95} ${x + w * 0.62} ${y + h * 0.05} ${x} ${y + h / 2} Z`;
  return `M${x - w / 2} ${y} a${w / 2} ${h / 2} 0 1 0 ${w} 0 a${w / 2} ${h / 2} 0 1 0 ${-w} 0 Z`;
}

const MESSAGES = { 'feliz-ano': 'Feliz año', 'te-quiero': 'Te quiero', 'un-ano-mas': 'Un año más' };

export function CakeVisual({ spec = {}, className, title, bakeValue: _unused, ...rest }) {
  const uid = useId().replace(/:/g, '');
  const layers = spec.capas ?? [];
  const w = 150;
  const x = 110;
  const layerH = 30;
  const base = 196;
  const topY = base - layers.length * layerH;
  const frost = spec.cobertura ? colorOf(PASTELERIA, 'cobertura', spec.cobertura) : null;
  const filling = spec.relleno ? colorOf(PASTELERIA, 'relleno', spec.relleno) : null;
  const deco = spec.decoracion ?? [];
  const radius = spec.forma === 'cuadrado' ? 3 : 14;
  return (
    <svg className={className} viewBox="0 0 220 230" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'} {...rest}>
      <defs>
        <linearGradient id={`plate${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d0ee" />
        </linearGradient>
        {layers.map((id, i) => {
          const c = colorOf(PASTELERIA, 'capas', id);
          return (
            <linearGradient key={i} id={`sponge${uid}${i}`} x1="0" x2="1">
              <stop offset="0" stopColor={dark(c, 0.12)} />
              <stop offset="0.3" stopColor={light(c, 0.12)} />
              <stop offset="1" stopColor={dark(c, 0.2)} />
            </linearGradient>
          );
        })}
        {frost && (
          <linearGradient id={`frost${uid}`} x1="0" x2="1">
            <stop offset="0" stopColor={dark(frost, 0.08)} />
            <stop offset="0.35" stopColor={light(frost, 0.2)} />
            <stop offset="1" stopColor={dark(frost, 0.12)} />
          </linearGradient>
        )}
        <radialGradient id={`flame${uid}`} cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.6" stopColor="#ffcf5a" />
          <stop offset="1" stopColor="#ff8a3a" />
        </radialGradient>
      </defs>
      {/* Plato de porcelana con borde */}
      <ellipse cx={x} cy={base + 14} rx="96" ry="14" fill="#000" opacity="0.15" />
      <ellipse cx={x} cy={base + 12} rx="94" ry="13" fill={`url(#plate${uid})`} stroke="#c3b8e0" />
      <ellipse cx={x} cy={base + 10} rx="76" ry="8" fill="none" stroke="#e8e2f6" strokeWidth="2" />
      {!layers.length && <rect x={x - w / 2} y={base - 60} width={w} height="60" rx="12" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />}
      {layers.map((id, i) => {
        const y = base - (i + 1) * layerH;
        const c = colorOf(PASTELERIA, 'capas', id);
        return (
          <g key={i}>
            <rect x={x - w / 2} y={y} width={w} height={layerH} rx={radius} fill={`url(#sponge${uid}${i})`} />
            {/* Miga: poros diminutos en el lateral */}
            {scatter(`miga-${id}-${i}`, 12).map((p, k) => (
              <circle key={k} cx={x - w / 2 + 8 + ((p.a / (Math.PI * 2)) * (w - 16))} cy={y + 6 + p.r * (layerH - 12)} r="1.2" fill={dark(c, 0.3)} opacity="0.35" />
            ))}
            {i > 0 && filling && (
              <>
                <rect x={x - w / 2 + 2} y={y + layerH - 5} width={w - 4} height="7" rx="3" fill={filling} />
                <rect x={x - w / 2 + 6} y={y + layerH - 4} width={w - 30} height="1.6" rx="1" fill="#fff" opacity="0.35" />
              </>
            )}
          </g>
        );
      })}
      {layers.length > 0 && (
        <>
          <path d={topFace(spec.forma, x, topY, w)} fill={frost ? `url(#frost${uid})` : colorOf(PASTELERIA, 'capas', layers.at(-1))} stroke="#000" strokeOpacity="0.08" />
          {frost && (
            <>
              <path
                d={`M${x - w / 2} ${topY + 2} h${w} v10 q-8 12 -14 0 q-8 16 -16 0 q-8 10 -16 0 q-8 14 -16 0 q-8 10 -16 0 q-8 16 -16 0 q-8 10 -16 0 q-8 12 -16 0 q-8 10 -14 0 z`}
                fill={`url(#frost${uid})`}
              />
              <path d={`M${x - w / 2 + 10} ${topY + 5} h${w * 0.35}`} stroke="#fff" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
          {spec.mensaje && MESSAGES[spec.mensaje] && (
            <text x={x} y={base - 10} textAnchor="middle" fontFamily="'Dancing Script', cursive" fontSize="17" fill="#fff" stroke="#6b3b5a" strokeWidth="0.6" paintOrder="stroke">
              {MESSAGES[spec.mensaje]}
            </text>
          )}
          {deco.includes('fresas') &&
            [-40, 0, 40].map((dx) => (
              <g key={dx}>
                <path d={`M${x + dx - 8} ${topY - 4} q8 22 16 0 q-8 -6 -16 0 z`} fill="#e0233f" />
                <path d={`M${x + dx - 5} ${topY - 2} q2 6 4 1`} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" fill="none" />
                {[0, 1, 2].map((k) => (
                  <circle key={k} cx={x + dx - 3 + k * 3} cy={topY + 4 + (k % 2) * 3} r="0.9" fill="#ffe27a" />
                ))}
                <path d={`M${x + dx - 6} ${topY - 5} l6 -4 l6 4`} stroke="#3b7a2a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            ))}
          {deco.includes('velas') &&
            [-22, 0, 22].map((dx) => (
              <g key={dx}>
                <rect x={x + dx - 3} y={topY - 34} width="6" height="26" rx="2" fill="#7fb8ff" />
                {[0, 1, 2].map((k) => (
                  <path key={k} d={`M${x + dx - 3} ${topY - 30 + k * 8} l6 -4`} stroke="#fff" strokeWidth="1.6" />
                ))}
                <circle cx={x + dx} cy={topY - 40} r="9" fill="#ffcf5a" opacity="0.25" />
                <path d={`M${x + dx} ${topY - 47} q5.5 7.5 0 12 q-5.5 -4.5 0 -12 z`} fill={`url(#flame${uid})`} />
              </g>
            ))}
          {deco.includes('chispas') &&
            scatter('chispas-pastel', 16).map((p, i) => (
              <rect key={i} x={x + Math.cos(p.a) * p.r * 60} y={topY + Math.sin(p.a) * p.r * 18} width="6" height="2.4" rx="1" fill={['#ffd166', '#ff6fb1', '#6fd3ff'][i % 3]} transform={`rotate(${p.rot} ${x + Math.cos(p.a) * p.r * 60} ${topY + Math.sin(p.a) * p.r * 18})`} />
            ))}
          {deco.includes('flores') &&
            [-56, 56].map((dx) => (
              <g key={dx} transform={`translate(${x + dx} ${topY + 2})`}>
                {[0, 72, 144, 216, 288].map((a) => (
                  <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 5} cy={Math.sin((a * Math.PI) / 180) * 5} r="4" fill="#ff8fc7" stroke="#e765a6" strokeWidth="0.6" />
                ))}
                <circle r="3" fill="#ffe27a" />
              </g>
            ))}
          {deco.includes('estrellas') &&
            [-30, 30, 0].map((dx, i) => (
              <path key={dx} transform={`translate(${x + dx} ${topY - 14 - i * 6}) scale(0.9)`} d="M0 -8 L2.4 -2.5 L8 -2.5 L3.5 1 L5 7 L0 3.6 L-5 7 L-3.5 1 L-8 -2.5 L-2.4 -2.5 Z" fill="#ffe27a" stroke="#d9a520" strokeWidth="0.8" />
            ))}
        </>
      )}
    </svg>
  );
}
