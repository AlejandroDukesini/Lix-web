/**
 * Dibujos (SVG) de lo que se prepara. Reciben la misma estructura que el pedido,
 * así sirven para el banco de trabajo (lo que llevas) y para la comanda (lo que
 * piden). Son decorativos: el texto de la comanda y del resultado describe lo mismo.
 */
import { HELADERIA, PASTELERIA, PIZZERIA } from '../recipes/recipes.js';
import { zoneOf } from '../engine/orders.js';

const colorOf = (recipe, stepId, id) => recipe.steps.find((s) => s.id === stepId)?.options.find((o) => o.id === id)?.color ?? '#ccc';

/** Posiciones pseudoaleatorias fijas (mismo ingrediente → mismo dibujo). */
function scatter(seedText, n) {
  let s = [...seedText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: n }, () => ({ a: rand() * Math.PI * 2, r: Math.sqrt(rand()), rot: rand() * 360 }));
}

// ------------------------------------------------------------------- Helado
export function IceCreamVisual({ spec = {}, className, title, ...rest }) {
  const scoops = spec.bolas ?? [];
  const container = spec.recipiente;
  const top = 150 - Math.max(0, scoops.length - 1) * 30;
  const topY = scoops.length ? top : 150;
  const toppings = spec.toppings ?? [];
  return (
    <svg className={className} viewBox="0 0 200 250" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'} {...rest}>
      <ellipse cx="100" cy="242" rx="56" ry="6" fill="#000" opacity="0.15" />
      {/* Recipiente */}
      {container === 'tarrina' ? (
        <g>
          <path d="M52 170 L148 170 L136 236 L64 236 Z" fill="#f4f0ff" stroke="#c9bff0" strokeWidth="2" />
          <path d="M56 186 L144 186" stroke="#ff9fc6" strokeWidth="6" />
        </g>
      ) : container ? (
        <g>
          <path d="M60 168 L140 168 L100 240 Z" fill={colorOf(HELADERIA, 'recipiente', container)} />
          <path d="M70 176 L118 222 M86 172 L126 206 M130 176 L82 222 M114 172 L74 206" stroke="#000" strokeOpacity="0.18" strokeWidth="2" />
        </g>
      ) : (
        <path d="M60 168 L140 168 L100 240 Z" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />
      )}
      {/* Bolas, de abajo arriba */}
      {scoops.map((id, i) => {
        const cy = 150 - i * 30;
        const c = colorOf(HELADERIA, 'bolas', id);
        return (
          <g key={i}>
            <circle cx="100" cy={cy} r="36" fill={c} />
            <path d={`M66 ${cy + 10} q8 10 17 2 q9 10 17 0 q9 10 17 0 q9 10 17 -2`} fill={c} stroke="#000" strokeOpacity="0.08" />
            <ellipse cx="88" cy={cy - 14} rx="10" ry="6" fill="#fff" opacity="0.35" />
          </g>
        );
      })}
      {/* Salsa sobre la bola de arriba */}
      {scoops.length > 0 && spec.salsa && spec.salsa !== 'ninguna' && (
        <path
          d={`M66 ${topY - 10} Q100 ${topY - 52} 134 ${topY - 10} q-4 16 -9 2 q-5 18 -11 2 q-6 20 -12 0 q-6 14 -12 -2 q-6 16 -11 2 z`}
          fill={colorOf(HELADERIA, 'salsa', spec.salsa)}
          opacity="0.92"
        />
      )}
      {scoops.length > 0 && toppings.includes('chispas') &&
        scatter('chispas', 14).map((p, i) => (
          <rect key={i} x={100 + Math.cos(p.a) * p.r * 26} y={topY - 14 + Math.sin(p.a) * p.r * 14} width="7" height="2.6" rx="1.3" fill={['#ff6fb1', '#6fd3ff', '#ffe066', '#8affb0'][i % 4]} transform={`rotate(${p.rot} ${100 + Math.cos(p.a) * p.r * 26} ${topY - 14 + Math.sin(p.a) * p.r * 14})`} />
        ))}
      {scoops.length > 0 && toppings.includes('nueces') &&
        scatter('nueces', 6).map((p, i) => <ellipse key={i} cx={100 + Math.cos(p.a) * p.r * 24} cy={topY - 10 + Math.sin(p.a) * p.r * 12} rx="5" ry="3.5" fill="#a86b3c" />)}
      {scoops.length > 0 && toppings.includes('galleta') && <rect x="112" y={topY - 50} width="16" height="34" rx="3" fill="#c98d4a" transform={`rotate(18 120 ${topY - 33})`} />}
      {scoops.length > 0 && toppings.includes('barquillo') && <rect x="70" y={topY - 56} width="7" height="44" rx="3" fill="#f0c27a" transform={`rotate(-20 73 ${topY - 34})`} />}
      {scoops.length > 0 && toppings.includes('cereza') && (
        <g>
          <path d={`M100 ${topY - 44} q6 -14 16 -18`} stroke="#3b7a2a" strokeWidth="2.5" fill="none" />
          <circle cx="100" cy={topY - 38} r="9" fill="#e0102f" />
          <circle cx="97" cy={topY - 41} r="2.5" fill="#fff" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}

// ------------------------------------------------------------------- Pizza
const PIZZA_R = { pequena: 64, mediana: 80, grande: 96 };
const BAKE_TINT = { cruda: 0, poco: 0.15, media: 0.32, bien: 0.5, quemada: 0.85 };

function mix(hex, toward, k) {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function Topping({ id, x, y, rot }) {
  switch (id) {
    case 'pepperoni':
      return <circle cx={x} cy={y} r="8" fill="#b8242a" stroke="#8a171c" strokeWidth="1.5" />;
    case 'champinones':
      return <path d={`M${x - 7} ${y} a7 6 0 0 1 14 0 z M${x - 2.5} ${y} h5 v6 h-5 z`} fill="#d9c7b0" stroke="#9a8670" strokeWidth="1" transform={`rotate(${rot} ${x} ${y})`} />;
    case 'aceitunas':
      return <circle cx={x} cy={y} r="4.5" fill="none" stroke="#2b2b2b" strokeWidth="3" />;
    case 'pimiento':
      return <path d={`M${x - 7} ${y} q7 -9 14 0`} fill="none" stroke="#3fa34d" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${rot} ${x} ${y})`} />;
    case 'cebolla':
      return <path d={`M${x - 6} ${y + 3} a6 6 0 0 1 12 0`} fill="none" stroke="#c99bd8" strokeWidth="2.5" transform={`rotate(${rot} ${x} ${y})`} />;
    case 'jamon':
      return <rect x={x - 6} y={y - 5} width="12" height="10" rx="2" fill="#f19aa6" transform={`rotate(${rot} ${x} ${y})`} />;
    case 'pina':
      return <path d={`M${x} ${y - 6} l6 10 h-12 z`} fill="#ffd84d" stroke="#d8a91f" strokeWidth="1" transform={`rotate(${rot} ${x} ${y})`} />;
    case 'albahaca':
      return <ellipse cx={x} cy={y} rx="7" ry="3.5" fill="#2f7d32" transform={`rotate(${rot} ${x} ${y})`} />;
    default:
      return null;
  }
}

export function PizzaVisual({ spec = {}, bakeValue, className, title, ...rest }) {
  const r = PIZZA_R[spec.tamano] ?? 80;
  const cx = 110;
  const cy = 110;
  const zone = bakeValue !== undefined ? zoneOf(bakeValue) : (spec.coccion ?? null);
  const tint = zone ? BAKE_TINT[zone] : 0;
  const dough = mix(colorOf(PIZZERIA, 'masa', spec.masa ?? 'clasica'), '#3a1d0c', tint);
  const sauce = spec.salsa ? colorOf(PIZZERIA, 'salsa', spec.salsa) : null;
  const cheese = spec.queso && spec.queso !== 'sin' ? colorOf(PIZZERIA, 'queso', spec.queso) : null;
  const items = spec.ingredientes ?? [];
  const n = (spec.tamano === 'grande' ? 9 : spec.tamano === 'pequena' ? 5 : 7) + (spec.queso === 'doble' ? 4 : 0);
  return (
    <svg className={className} viewBox="0 0 220 220" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'} {...rest}>
      <circle cx={cx} cy={cy} r="106" fill="#c99a6b" opacity="0.35" />
      {spec.tamano ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill={dough} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeOpacity={spec.masa === 'fina' ? 0.08 : 0.15} strokeWidth={spec.masa === 'fina' ? 3 : 7} />
          {sauce && <circle cx={cx} cy={cy} r={r - (spec.masa === 'fina' ? 6 : 11)} fill={mix(sauce, '#3a1d0c', tint * 0.5)} />}
          {cheese &&
            scatter(`queso-${spec.queso}`, n).map((p, i) => (
              <circle key={i} cx={cx + Math.cos(p.a) * p.r * (r - 24)} cy={cy + Math.sin(p.a) * p.r * (r - 24)} r={spec.queso === 'doble' ? 15 : 12} fill={mix(cheese, '#b5651d', tint * 0.6)} opacity="0.9" />
            ))}
          {items.map(({ id, place }) =>
            scatter(id, place === 'toda' ? 8 : 4).map((p, i) => {
              let angle = p.a;
              if (place === 'izq') angle = Math.PI / 2 + (p.a / (Math.PI * 2)) * Math.PI;
              if (place === 'der') angle = -Math.PI / 2 + (p.a / (Math.PI * 2)) * Math.PI;
              const dist = (0.25 + p.r * 0.75) * (r - 22);
              return <Topping key={`${id}-${i}`} id={id} x={cx + Math.cos(angle) * dist} y={cy + Math.sin(angle) * dist} rot={p.rot} />;
            }),
          )}
          {items.some((i) => i.place !== 'toda') && <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#fff" strokeOpacity="0.35" strokeDasharray="4 5" />}
          {zone === 'quemada' && <circle cx={cx} cy={cy} r={r} fill="#1a0a04" opacity="0.35" />}
        </>
      ) : (
        <circle cx={cx} cy={cy} r="80" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />
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

export function CakeVisual({ spec = {}, className, title, ...rest }) {
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
      <ellipse cx={x} cy={base + 12} rx="92" ry="12" fill="#e9e3f5" stroke="#c9bfe0" />
      {!layers.length && <rect x={x - w / 2} y={base - 60} width={w} height="60" rx="12" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />}
      {layers.map((id, i) => {
        const y = base - (i + 1) * layerH;
        return (
          <g key={i}>
            <rect x={x - w / 2} y={y} width={w} height={layerH} rx={radius} fill={colorOf(PASTELERIA, 'capas', id)} />
            {i > 0 && filling && <rect x={x - w / 2 + 2} y={y + layerH - 5} width={w - 4} height="7" rx="3" fill={filling} />}
          </g>
        );
      })}
      {layers.length > 0 && (
        <>
          <path d={topFace(spec.forma, x, topY, w)} fill={frost ?? colorOf(PASTELERIA, 'capas', layers.at(-1))} stroke="#000" strokeOpacity="0.08" />
          {frost && (
            <path
              d={`M${x - w / 2} ${topY + 2} h${w} v10 q-8 12 -14 0 q-8 16 -16 0 q-8 10 -16 0 q-8 14 -16 0 q-8 10 -16 0 q-8 16 -16 0 q-8 10 -16 0 q-8 12 -16 0 q-8 10 -14 0 z`}
              fill={frost}
            />
          )}
          {spec.mensaje && MESSAGES[spec.mensaje] && (
            <text x={x} y={base - 10} textAnchor="middle" fontFamily="'Dancing Script', cursive" fontSize="17" fill="#fff" stroke="#6b3b5a" strokeWidth="0.6" paintOrder="stroke">
              {MESSAGES[spec.mensaje]}
            </text>
          )}
          {deco.includes('fresas') &&
            [-40, 0, 40].map((dx) => (
              <g key={dx}>
                <path d={`M${x + dx - 8} ${topY - 4} q8 20 16 0 q-8 -6 -16 0 z`} fill="#e0233f" />
                <path d={`M${x + dx - 6} ${topY - 5} l6 -4 l6 4`} stroke="#3b7a2a" strokeWidth="2.5" fill="none" />
              </g>
            ))}
          {deco.includes('velas') &&
            [-22, 0, 22].map((dx) => (
              <g key={dx}>
                <rect x={x + dx - 3} y={topY - 34} width="6" height="26" rx="2" fill="#7fb8ff" />
                <path d={`M${x + dx} ${topY - 46} q5 7 0 11 q-5 -4 0 -11 z`} fill="#ffcf5a" />
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
                  <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 5} cy={Math.sin((a * Math.PI) / 180) * 5} r="4" fill="#ff8fc7" />
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
