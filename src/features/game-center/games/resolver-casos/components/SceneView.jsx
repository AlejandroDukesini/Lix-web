import {
  Brush,
  Camera,
  Check,
  Coffee,
  DoorOpen,
  Footprints,
  Frame,
  Key,
  Lamp,
  LockKeyhole,
  Monitor,
  NotebookPen,
  Pin,
  Power,
  Receipt,
  Shirt,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Trash2,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { cx } from '../../../../../utils/cx.js';

export const SCENE_ICONS = {
  plate: UtensilsCrossed,
  footprints: Footprints,
  door: DoorOpen,
  receipt: Receipt,
  notebook: NotebookPen,
  key: Key,
  wrench: Wrench,
  camera: Camera,
  frame: Frame,
  panel: ShieldAlert,
  brush: Brush,
  monitor: Monitor,
  cup: Coffee,
  pin: Pin,
  trash: Trash2,
  lock: LockKeyhole,
  lamp: Lamp,
  cart: ShoppingCart,
  sparkle: Sparkles,
  power: Power,
  shirt: Shirt,
  note: StickyNote,
};

/*
 * Decorados originales de cada lugar (SVG ligero, 160×100), dibujados en
 * perspectiva frontal: pared con luz, suelo que se aleja hacia un punto de
 * fuga, muebles con su sombra. Son ambientación; lo interactivo va encima y
 * cada mueble está donde su punto de interés (x, y en %) lo espera.
 */
const VP = [80, 34]; // punto de fuga

/** Juntas del suelo que convergen al punto de fuga, desde la línea del zócalo `top`. */
function FloorLines({ top, step = 16, color, width = 0.6 }) {
  const k = (top - VP[1]) / (100 - VP[1]);
  const lines = [];
  for (let x = -80; x <= 240; x += step) lines.push(<line key={x} x1={VP[0] + (x - VP[0]) * k} y1={top} x2={x} y2="100" stroke={color} strokeWidth={width} />);
  return <g>{lines}</g>;
}

/** Sombra suave en el suelo bajo un mueble. */
const Shadow = ({ x, y, rx, ry = 2.5, o = 0.35 }) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="url(#cs-shadow)" opacity={o} />;

const COMMON = (
  <defs>
    <linearGradient id="cs-light" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
      <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
    </linearGradient>
    <radialGradient id="cs-shadow">
      <stop offset="0" stopColor="#000" stopOpacity="0.9" />
      <stop offset="1" stopColor="#000" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="cs-vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#120a14" stopOpacity="0.55" />
    </radialGradient>
    <linearGradient id="cs-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff6d8" stopOpacity="0.5" />
      <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
    </linearGradient>
    <linearGradient id="cs-floor-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#000" stopOpacity="0.28" />
      <stop offset="0.4" stopColor="#000" stopOpacity="0" />
    </linearGradient>
  </defs>
);

function Kitchen() {
  return (
    <>
      <defs>
        <linearGradient id="cs-k-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe9cc" />
          <stop offset="1" stopColor="#e9cfa6" />
        </linearGradient>
        <linearGradient id="cs-k-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ccdf5" />
          <stop offset="1" stopColor="#d8f0ff" />
        </linearGradient>
      </defs>
      <rect width="160" height="64" fill="url(#cs-k-wall)" />
      {/* Azulejos con junta. */}
      <rect x="28" y="30" width="132" height="12" fill="#cfe3ea" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={28.5 + i * 9.5} y="30.5" width="9" height="5.5" rx="0.6" fill={i % 2 ? '#e8f2f5' : '#d9eaf0'} />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={24 + i * 9.5} y="36.5" width="9" height="5.5" rx="0.6" fill={i % 2 ? '#d9eaf0' : '#e8f2f5'} />
      ))}
      {/* Ventana con cortinas y la luz que entra. */}
      <rect x="60" y="6" width="40" height="22" rx="1.5" fill="#fff" />
      <rect x="62" y="8" width="36" height="18" fill="url(#cs-k-sky)" />
      <path d="M62 22 q8 -6 16 -2 q10 -6 20 0 v6 h-36z" fill="#9cd38a" />
      <rect x="79" y="8" width="2" height="18" fill="#fff" />
      <path d="M57 4 h10 q-2 12 2 26 h-12z" fill="#e2725b" />
      <path d="M103 4 h-10 q2 12 -2 26 h12z" fill="#e2725b" />
      <rect x="55" y="3" width="50" height="2" rx="1" fill="#8a5a34" />
      {/* Suelo de tablas en perspectiva. */}
      <rect y="64" width="160" height="36" fill="#c58c58" />
      <FloorLines top={64} color="#a8723f" width={0.8} />
      <rect y="64" width="160" height="36" fill="url(#cs-floor-fade)" />
      <path d="M62 64 L98 64 L118 100 L42 100Z" fill="url(#cs-beam)" opacity="0.5" />
      <rect y="62" width="160" height="2.5" fill="#9b6a3f" />
      {/* Puerta del jardín, con cristal. */}
      <rect x="3" y="18" width="26" height="47" rx="1" fill="#6e4628" />
      <rect x="5" y="20" width="22" height="44" fill="#8a5a34" />
      <rect x="8" y="23" width="16" height="16" fill="#bfe3ff" stroke="#6e4628" strokeWidth="1" />
      <path d="M16 23 v16 M8 31 h16" stroke="#6e4628" strokeWidth="0.8" />
      <rect x="8" y="43" width="16" height="17" rx="1" fill="#7a4c2a" />
      <circle cx="24" cy="44" r="1.2" fill="#e8c26a" />
      {/* Mesa con mantel. */}
      <Shadow x={80} y={79} rx={34} ry={4} />
      <path d="M50 49 h60 l3 7 h-66z" fill="#f4f1ea" />
      <path d="M47 56 h66 v3 h-66z" fill="#e2ddd2" />
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M${50 + i * 9} 49 l${i < 3 ? -1 : 1} 7`} stroke="#e48d8d" strokeWidth="1.6" />
      ))}
      <rect x="54" y="59" width="3.5" height="19" fill="#7a4c2a" />
      <rect x="102.5" y="59" width="3.5" height="19" fill="#7a4c2a" />
      {/* Encimera con armarios y utensilios colgados. */}
      <Shadow x={139} y={67} rx={24} ry={2} />
      <rect x="116" y="40" width="44" height="26" fill="#efe9de" />
      <rect x="116" y="37" width="44" height="4" fill="#7e776d" />
      {[118, 132, 146].map((x) => (
        <g key={x}>
          <rect x={x} y="44" width="12" height="20" rx="1" fill="#f8f4ec" stroke="#d9d1c3" strokeWidth="0.6" />
          <rect x={x + 5} y="46" width="2" height="5" rx="1" fill="#a99d8a" />
        </g>
      ))}
      <path d="M122 10 h32" stroke="#7e776d" strokeWidth="1.2" />
      <path d="M127 10 v8 a3 3 0 1 0 2 0 M138 10 v12 M136 22 h4 M148 10 v7" stroke="#6d6a66" strokeWidth="1" fill="none" />
      <circle cx="148" cy="20" r="3.5" fill="#c8693c" />
    </>
  );
}

function Garage() {
  return (
    <>
      <defs>
        <linearGradient id="cs-g-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6dae2" />
          <stop offset="1" stopColor="#b5bac4" />
        </linearGradient>
        <linearGradient id="cs-g-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9b0bc" />
          <stop offset="1" stopColor="#8c939f" />
        </linearGradient>
      </defs>
      <rect width="160" height="66" fill="url(#cs-g-wall)" />
      {/* Bloques de hormigón. */}
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) => (
          <rect key={`${r}-${c}`} x={c * 22 + (r % 2 ? 11 : 0) - 6} y={r * 11} width="21" height="10" fill="none" stroke="#a7acb7" strokeWidth="0.5" />
        )),
      )}
      {/* Fluorescente con su halo. */}
      <ellipse cx="50" cy="6" rx="34" ry="10" fill="#fffbe6" opacity="0.35" />
      <rect x="30" y="3" width="40" height="3" rx="1.5" fill="#fffdf2" />
      {/* Portón enrollable. */}
      <rect x="92" y="4" width="62" height="62" fill="#6b717c" />
      <rect x="95" y="7" width="56" height="59" fill="url(#cs-g-door)" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <rect x="95" y={9 + i * 6.4} width="56" height="1.2" fill="#7b828e" />
          <rect x="95" y={10.2 + i * 6.4} width="56" height="0.6" fill="#c3c9d3" />
        </g>
      ))}
      <rect x="119" y="60" width="8" height="2" rx="1" fill="#555b66" />
      {/* Cámara en la esquina del portón. */}
      <path d="M144 6 l-6 4" stroke="#3a3e47" strokeWidth="1.4" />
      <rect x="132" y="9" width="11" height="6" rx="1.5" fill="#2e323b" transform="rotate(14 137 12)" />
      <circle cx="133" cy="13.5" r="1.6" fill="#7fb2e0" />
      {/* Gancho de llaves. */}
      <rect x="12" y="26" width="20" height="5" rx="1" fill="#6b4524" />
      {[16, 22, 28].map((x) => (
        <path key={x} d={`M${x} 31 v3 a1.5 1.5 0 1 0 1 0`} stroke="#8a8f99" strokeWidth="0.8" fill="none" />
      ))}
      <circle cx="22" cy="37" r="1.8" fill="none" stroke="#d4a93c" strokeWidth="1" />
      {/* Panel de herramientas. */}
      <rect x="40" y="18" width="40" height="22" rx="1" fill="#c9a777" />
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => <circle key={`${r}-${c}`} cx={42 + c * 4} cy={20 + r * 4.4} r="0.4" fill="#8e6f45" />),
      )}
      <path d="M46 22 v12 M44 34 h4 M56 22 l6 12 M66 22 v10 a2 2 0 1 0 2 0 v-10" stroke="#4a4f5a" strokeWidth="1.4" fill="none" />
      {/* Suelo de hormigón con mancha de aceite. */}
      <rect y="66" width="160" height="34" fill="#80858f" />
      <FloorLines top={66} step={32} color="#70757e" width={0.5} />
      <rect y="66" width="160" height="34" fill="url(#cs-floor-fade)" />
      <ellipse cx="120" cy="86" rx="16" ry="4" fill="#4d5058" opacity="0.6" />
      <rect y="64.5" width="160" height="2" fill="#6c7079" />
      {/* Banco de trabajo con el cuaderno de registro al lado. */}
      <Shadow x={72} y={78} rx={32} ry={3} />
      <rect x="44" y="55" width="56" height="5" rx="1" fill="#9b6b3c" />
      <rect x="44" y="55" width="56" height="1.5" fill="#b9864f" />
      <rect x="47" y="60" width="3" height="18" fill="#6b4524" />
      <rect x="94" y="60" width="3" height="18" fill="#6b4524" />
      <rect x="47" y="70" width="50" height="2" fill="#6b4524" />
      <rect x="60" y="50" width="10" height="5" rx="1" fill="#c84a3a" />
      <Shadow x={126} y={67} rx={14} ry={1.6} />
      <rect x="114" y="42" width="24" height="24" fill="#5c6270" />
      <rect x="117" y="38" width="16" height="5" rx="0.8" fill="#f2e6c4" transform="rotate(-6 125 40)" />
      {/* Bicicleta. */}
      <g stroke="#2c2c34" strokeWidth="1.8" fill="none">
        <circle cx="54" cy="88" r="8" />
        <circle cx="82" cy="88" r="8" />
        <path d="M54 88 l10 -12 h12 l6 12 M64 76 l4 12 l8 -12 M62 74 h5 M76 76 l-1 -4 h4" stroke="#c0392b" />
      </g>
    </>
  );
}

function Museum() {
  return (
    <>
      <defs>
        <linearGradient id="cs-m-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5e1f2b" />
          <stop offset="1" stopColor="#7d3040" />
        </linearGradient>
        <linearGradient id="cs-m-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d27a" />
          <stop offset="0.5" stopColor="#c8962f" />
          <stop offset="1" stopColor="#8a6418" />
        </linearGradient>
        <linearGradient id="cs-m-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b6ea8" />
          <stop offset="1" stopColor="#9ec3e6" />
        </linearGradient>
      </defs>
      <rect width="160" height="70" fill="url(#cs-m-wall)" />
      {/* Zócalo de madera con molduras. */}
      <rect y="52" width="160" height="16" fill="#4a1a24" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={i * 20 + 3} y="55" width="14" height="10" fill="none" stroke="#6b2c38" strokeWidth="0.8" />
      ))}
      {/* Focos del techo. */}
      {[28, 80, 132].map((x) => (
        <g key={x}>
          <path d={`M${x - 3} 0 L${x - 16} 50 L${x + 16} 50 L${x + 3} 0Z`} fill="url(#cs-beam)" opacity="0.55" />
          <rect x={x - 3} y="0" width="6" height="3" rx="1" fill="#1d1d22" />
        </g>
      ))}
      {/* La copia, en marco dorado. */}
      <rect x="60" y="10" width="40" height="30" fill="url(#cs-m-gold)" />
      <rect x="64" y="14" width="32" height="22" fill="url(#cs-m-sky)" />
      <circle cx="88" cy="20" r="3.5" fill="#f6d365" />
      <path d="M64 36 L72 26 L78 31 L86 23 L96 33 V36Z" fill="#2f5d3a" />
      <path d="M64 36 q16 -4 32 0z" fill="#3e7a4a" />
      {/* Cuadros laterales. */}
      <rect x="20" y="14" width="18" height="15" fill="url(#cs-m-gold)" />
      <rect x="22.5" y="16.5" width="13" height="10" fill="#c9a07a" />
      <circle cx="29" cy="21" r="3" fill="#8a4b3a" />
      <rect x="122" y="14" width="18" height="15" fill="url(#cs-m-gold)" />
      <rect x="124.5" y="16.5" width="13" height="10" fill="#6d8fa8" />
      <path d="M124.5 26.5 l4 -5 l3 3 l3 -4 l3 6z" fill="#e8e1d0" />
      {/* Panel de la alarma. */}
      <rect x="13" y="34" width="12" height="15" rx="1.5" fill="#2a2d35" />
      <rect x="15" y="36" width="8" height="3" fill="#6fe39a" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={15.2 + (i % 3) * 2.8} y={41 + Math.floor(i / 3) * 3} width="2" height="2" rx="0.4" fill="#9aa0ad" />
      ))}
      {/* Puerta del almacén. */}
      <rect x="100" y="34" width="24" height="36" fill="#3a1820" />
      <rect x="102" y="36" width="20" height="34" fill="#5a2f22" />
      <circle cx="119" cy="54" r="1.2" fill="#e0b84f" />
      <rect x="104" y="40" width="16" height="5" rx="0.8" fill="#e8e1d0" />
      {/* Suelo de parqué en perspectiva. */}
      <rect y="70" width="160" height="30" fill="#a8774a" />
      <FloorLines top={70} step={10} color="#8d6038" width={0.5} />
      <rect y="70" width="160" height="30" fill="url(#cs-floor-fade)" />
      <rect y="68" width="160" height="2.5" fill="#3a1820" />
      {/* Atril con el registro y cordón de seguridad. */}
      <Shadow x={138} y={78} rx={10} ry={1.6} />
      <path d="M132 44 h14 l-2 4 h-10z" fill="#4a2d1e" />
      <rect x="137.5" y="48" width="3" height="29" fill="#4a2d1e" />
      <rect x="133" y="76" width="12" height="2" rx="1" fill="#4a2d1e" />
      <Shadow x={80} y={84} rx={30} ry={2} />
      {[56, 104].map((x) => (
        <g key={x}>
          <rect x={x - 1} y="66" width="2" height="18" fill="#d9b25b" />
          <ellipse cx={x} cy="84" rx="4" ry="1.4" fill="#b8902f" />
          <circle cx={x} cy="66" r="1.8" fill="#f3d27a" />
        </g>
      ))}
      <path d="M57 67 q23 10 46 0" stroke="#a3122c" strokeWidth="2" fill="none" />
    </>
  );
}

function Office() {
  return (
    <>
      <defs>
        <linearGradient id="cs-o-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6eef5" />
          <stop offset="1" stopColor="#cbd8e4" />
        </linearGradient>
        <linearGradient id="cs-o-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb6e6" />
          <stop offset="1" stopColor="#d2e8f8" />
        </linearGradient>
      </defs>
      <rect width="160" height="64" fill="url(#cs-o-wall)" />
      {/* Ventanal con la ciudad. */}
      <rect x="20" y="4" width="72" height="34" fill="#8a96a3" />
      <rect x="22" y="6" width="68" height="30" fill="url(#cs-o-sky)" />
      {[[24, 20, 8], [33, 14, 7], [41, 22, 9], [51, 10, 8], [60, 18, 10], [71, 24, 7], [79, 15, 9]].map(([x, top, w]) => (
        <rect key={x} x={x} y={top} width={w} height={36 - top} fill="#9fb3c6" />
      ))}
      {[[35, 18], [53, 14], [53, 22], [62, 22], [81, 19], [81, 27]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill="#fff8d6" />
      ))}
      <path d="M45 6 v30 M68 6 v30" stroke="#8a96a3" strokeWidth="1.2" />
      {/* Tablón de corcho. */}
      <rect x="110" y="10" width="42" height="26" rx="1.5" fill="#9b7346" />
      <rect x="112" y="12" width="38" height="22" fill="#c8a272" />
      {[[115, 14, '#fff8d6', -4], [127, 16, '#ffd1dc', 3], [139, 13, '#d6f5ff', -2], [119, 24, '#fff', 5], [134, 25, '#fff8d6', -3]].map(([x, y, c, r]) => (
        <g key={`${x}-${y}`} transform={`rotate(${r} ${x + 4} ${y + 4})`}>
          <rect x={x} y={y} width="9" height="8" fill={c} />
          <circle cx={x + 4.5} cy={y + 1} r="0.9" fill="#d23a3a" />
        </g>
      ))}
      {/* Moqueta. */}
      <rect y="64" width="160" height="36" fill="#8ea0b4" />
      <FloorLines top={64} step={40} color="#8396ab" width={0.4} />
      <rect y="64" width="160" height="36" fill="url(#cs-floor-fade)" />
      <rect y="62.5" width="160" height="2" fill="#7d8ea2" />
      <path d="M40 64 L72 64 L86 100 L18 100Z" fill="url(#cs-beam)" opacity="0.35" />
      {/* Mesa con el ordenador de Elena y la taza. */}
      <Shadow x={58} y={84} rx={40} ry={3.5} />
      <rect x="20" y="56" width="78" height="4" rx="1" fill="#5c6b7c" />
      <rect x="20" y="56" width="78" height="1.4" fill="#7a8a9c" />
      <rect x="24" y="60" width="3" height="23" fill="#4a5766" />
      <rect x="91" y="60" width="3" height="23" fill="#4a5766" />
      <rect x="44" y="38" width="28" height="17" rx="1.5" fill="#22262e" />
      <rect x="46" y="40" width="24" height="13" fill="#4f7fb8" />
      <rect x="48" y="42" width="12" height="1.5" fill="#cfe2f5" />
      <rect x="48" y="45" width="18" height="1" fill="#a9c6e6" />
      <rect x="48" y="47.5" width="15" height="1" fill="#a9c6e6" />
      <rect x="56" y="55" width="4" height="1.5" fill="#22262e" />
      <rect x="46" y="57.5" width="22" height="1.6" rx="0.6" fill="#2e323b" />
      <path d="M86 51 h6 v5 a3 3 0 0 1 -6 0z" fill="#f1f1f1" stroke="#9aa5b1" strokeWidth="0.5" />
      <path d="M92 52.5 a1.8 1.8 0 0 1 0 3" stroke="#9aa5b1" strokeWidth="0.8" fill="none" />
      <path d="M88 49 q1 -2 0 -3 M90 49 q1 -2 0 -3" stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.8" />
      {/* Planta y papelera. */}
      <rect x="4" y="40" width="10" height="22" rx="4" fill="#4f9a5e" />
      <path d="M9 40 q-6 -8 -3 -14 M9 40 q4 -10 8 -12 M9 40 q0 -10 1 -16" stroke="#3c7d4a" strokeWidth="2" fill="none" />
      <rect x="5" y="58" width="8" height="8" fill="#8a6a4a" />
      <Shadow x={22} y={87} rx={7} ry={1.4} />
      <path d="M17 72 h10 l-1.4 14 h-7.2z" fill="#5b6675" />
      <path d="M17 72 h10" stroke="#3e4753" strokeWidth="1" />
      <path d="M19.5 71 l2 -3 l2 3" fill="#f2f2f2" />
    </>
  );
}

function Hotel() {
  return (
    <>
      <defs>
        <linearGradient id="cs-h-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3e6d3" />
          <stop offset="1" stopColor="#e3cfb4" />
        </linearGradient>
        <radialGradient id="cs-h-lamp">
          <stop offset="0" stopColor="#fff2c2" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff2c2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="64" fill="url(#cs-h-wall)" />
      {/* Papel pintado de rayas con motivo. */}
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={i * 10 + 4} y="0" width="2" height="64" fill="#e2cfb5" />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={`M${i * 10 + 9} ${10 + (i % 2) * 14} l1.5 -2 l1.5 2 l-1.5 2z`} fill="#d7bf9c" />
      ))}
      {/* Puerta con cerradura electrónica. */}
      <rect x="3" y="16" width="24" height="49" fill="#4e3322" />
      <rect x="5" y="18" width="20" height="47" fill="#6e4a33" />
      <rect x="7" y="21" width="16" height="18" rx="1" fill="none" stroke="#5a3b27" strokeWidth="0.8" />
      <rect x="7" y="43" width="16" height="18" rx="1" fill="none" stroke="#5a3b27" strokeWidth="0.8" />
      <rect x="18" y="38" width="5" height="9" rx="1" fill="#22252c" />
      <circle cx="20.5" cy="40.5" r="0.9" fill="#e5484d" />
      <rect x="19" y="43" width="3" height="2.5" fill="#3d4250" />
      {/* Espejo con marco dorado. */}
      <ellipse cx="62" cy="26" rx="10" ry="13" fill="#c8962f" />
      <ellipse cx="62" cy="26" rx="8" ry="11" fill="#cfe0ea" />
      <path d="M57 20 l6 -6 M58 26 l8 -8" stroke="#fff" strokeWidth="1" opacity="0.7" />
      {/* Moqueta. */}
      <rect y="64" width="160" height="36" fill="#7e3443" />
      <rect y="64" width="160" height="36" fill="url(#cs-floor-fade)" />
      <rect y="62.5" width="160" height="2" fill="#5c2531" />
      {/* Alfombra con orla. */}
      <ellipse cx="84" cy="88" rx="46" ry="8" fill="#a5546a" />
      <ellipse cx="84" cy="88" rx="40" ry="6" fill="none" stroke="#e5c07b" strokeWidth="0.8" />
      <ellipse cx="84" cy="88" rx="22" ry="3" fill="none" stroke="#e5c07b" strokeWidth="0.6" />
      {/* Cama, a la derecha. */}
      <Shadow x={140} y={72} rx={24} ry={3} />
      <rect x="118" y="24" width="42" height="22" rx="4" fill="#6e4a33" />
      <rect x="121" y="27" width="36" height="16" rx="3" fill="#8a5f43" />
      <rect x="118" y="44" width="42" height="26" rx="2" fill="#fbfaf7" />
      <rect x="118" y="52" width="42" height="18" rx="2" fill="#d8c8e8" />
      <path d="M118 52 h42" stroke="#bfaed4" strokeWidth="1" />
      <rect x="122" y="40" width="16" height="9" rx="4" fill="#ffffff" stroke="#e6e1d8" strokeWidth="0.6" />
      <rect x="140" y="40" width="16" height="9" rx="4" fill="#ffffff" stroke="#e6e1d8" strokeWidth="0.6" />
      {/* Mesilla con lámpara encendida. */}
      <circle cx="112" cy="40" r="16" fill="url(#cs-h-lamp)" />
      <Shadow x={112} y={67} rx={10} ry={1.4} />
      <rect x="103" y="50" width="18" height="16" rx="1" fill="#6e4a33" />
      <rect x="103" y="50" width="18" height="2" fill="#8a5f43" />
      <rect x="105" y="56" width="14" height="4" rx="0.6" fill="none" stroke="#4e3322" strokeWidth="0.6" />
      <rect x="111" y="42" width="2" height="8" fill="#c8962f" />
      <path d="M106 42 l2.5 -8 h7 l2.5 8z" fill="#f6e3b4" />
      <rect x="107" y="47" width="5" height="3" rx="0.6" fill="#2a2d35" />
      {/* Carro de limpieza asomando en el pasillo. */}
      <Shadow x={48} y={86} rx={12} ry={1.8} />
      <rect x="38" y="66" width="20" height="16" rx="1" fill="#c9d2dc" />
      <rect x="40" y="68" width="16" height="5" fill="#f2f2f2" />
      <rect x="40" y="75" width="16" height="5" fill="#9fd3c7" />
      <path d="M58 66 v-6 h4" stroke="#8a96a3" strokeWidth="1.4" fill="none" />
      <circle cx="41" cy="84" r="2" fill="#2a2d35" />
      <circle cx="55" cy="84" r="2" fill="#2a2d35" />
    </>
  );
}

function Lighthouse() {
  return (
    <>
      <defs>
        <linearGradient id="cs-l-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1a2e" />
          <stop offset="1" stopColor="#2a4466" />
        </linearGradient>
        <radialGradient id="cs-l-lamp">
          <stop offset="0" stopColor="#fff2c2" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff2c2" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Muro de piedra con sillares irregulares. */}
      <rect width="160" height="100" fill="#8f9aa6" />
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * 18 + (r % 2 ? 9 : 0) - 4}
            y={r * 11}
            width="17"
            height="10"
            rx="2"
            fill={(r * 7 + c * 3) % 5 === 0 ? '#848f9b' : r % 2 ? '#9aa5b1' : '#a5afba'}
            stroke="#7c8692"
            strokeWidth="0.5"
          />
        )),
      )}
      {/* Ventana redonda: noche de tormenta sobre el mar. */}
      <circle cx="99" cy="25" r="17" fill="#5f6b78" />
      <circle cx="99" cy="25" r="14.5" fill="url(#cs-l-night)" />
      <path d="M84.5 30 q7 -3 14.5 0 q7 3 14.5 0 v4 a14.5 14.5 0 0 1 -29 0z" fill="#1d3550" />
      <path d="M90 14 l3 6 l-2 0 l3 6" stroke="#fff6c8" strokeWidth="0.9" fill="none" />
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={88 + i * 5} y1="12" x2={85 + i * 5} y2="38" stroke="#7fb2e0" strokeWidth="0.5" opacity="0.6" />
      ))}
      <path d="M84.5 25 h29 M99 10.5 v29" stroke="#5f6b78" strokeWidth="1.4" />
      {/* Interruptor junto a la ventana. */}
      <rect x="102" y="34" width="8" height="10" rx="1.2" fill="#e8e1d0" stroke="#6d6458" strokeWidth="0.6" />
      <rect x="104.8" y="36.5" width="2.4" height="4.5" rx="0.6" fill="#6d6458" />
      {/* Suelo de tablones. */}
      <rect y="66" width="160" height="34" fill="#5e5348" />
      <FloorLines top={66} step={14} color="#4d443b" width={0.7} />
      <rect y="66" width="160" height="34" fill="url(#cs-floor-fade)" />
      <rect y="64.5" width="160" height="2" fill="#4a4038" />
      {/* Mesa del farero con quinqué y bitácora. */}
      <circle cx="80" cy="46" r="22" fill="url(#cs-l-lamp)" />
      <Shadow x={70} y={80} rx={28} ry={3} />
      <rect x="44" y="57" width="52" height="4" rx="1" fill="#7a5a3a" />
      <rect x="44" y="57" width="52" height="1.4" fill="#93704b" />
      <rect x="48" y="61" width="3" height="19" fill="#5e4430" />
      <rect x="89" y="61" width="3" height="19" fill="#5e4430" />
      <rect x="62" y="53" width="16" height="4" rx="0.6" fill="#3e5c7a" />
      <path d="M70 53 v4" stroke="#e8e1d0" strokeWidth="0.6" />
      <rect x="77" y="52" width="6" height="5" rx="1" fill="#b98b3a" />
      <path d="M78 52 q2 -8 4 0" fill="#fff6c8" opacity="0.9" />
      <rect x="77.5" y="44" width="5" height="8" rx="2" fill="#fff" opacity="0.35" />
      {/* Perchero con el impermeable amarillo. */}
      <Shadow x={24} y={84} rx={8} ry={1.4} />
      <rect x="22.5" y="26" width="3" height="58" fill="#5e4430" />
      <path d="M17 82 h14" stroke="#5e4430" strokeWidth="2" />
      <path d="M24 30 l-7 -4 M24 30 l7 -4" stroke="#5e4430" strokeWidth="1.6" />
      <path d="M17 30 q-4 2 -5 14 l3 34 h18 l2 -34 q-2 -12 -6 -14 q-2 4 -6 4 q-4 0 -6 -4z" fill="#f2c230" />
      <path d="M24 34 v44" stroke="#c99c1c" strokeWidth="0.8" />
      <rect x="15.5" y="64" width="7" height="6" rx="1" fill="#d9a91f" />
      <path d="M17 64 h4" stroke="#fff" strokeWidth="0.8" opacity="0.8" />
      {/* Escalera de caracol que baja. */}
      <path d="M126 100 L126 72 L138 72 L138 62 L150 62 L150 52 L160 52 V100Z" fill="#6a5d50" />
      <path d="M126 72 h12 M138 62 h12 M150 52 h10" stroke="#8a7a68" strokeWidth="1.2" />
      <path d="M124 70 L136 60 L148 50 L160 42" stroke="#3e352c" strokeWidth="1.4" fill="none" />
    </>
  );
}

const BACKDROPS = { kitchen: Kitchen, garage: Garage, museum: Museum, office: Office, hotel: Hotel, lighthouse: Lighthouse };

function Backdrop({ kind }) {
  const Scene = BACKDROPS[kind];
  return Scene ? <Scene /> : <rect width="160" height="100" fill="#ccc" />;
}

/** Escenario con los objetos que se pueden examinar. */
export function SceneView({ caseData, found, lastClue, onExamine }) {
  return (
    <div className="cs-scene">
      <svg className="cs-scene__backdrop" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        {COMMON}
        <Backdrop kind={caseData.scene.kind} />
        <rect width="160" height="100" fill="url(#cs-light)" />
        <rect width="160" height="100" fill="url(#cs-vignette)" />
      </svg>
      <ul className="cs-scene__spots" aria-label="Objetos que puedes examinar">
        {caseData.scene.hotspots.map((spot) => {
          const Icon = SCENE_ICONS[spot.icon] ?? Sparkles;
          const done = found.includes(spot.clue);
          return (
            // Cerca de los bordes, la etiqueta se alinea hacia dentro para no salirse del escenario.
            <li key={spot.id} className={spot.x < 22 ? 'is-start' : spot.x > 78 ? 'is-end' : undefined} style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
              <button
                type="button"
                className={cx('cs-spot', done && 'is-done', lastClue === spot.clue && 'is-last')}
                onClick={() => onExamine(spot.id)}
                aria-label={`${spot.label}${done ? ' (examinado)' : ''}`}
              >
                <Icon aria-hidden="true" />
                {done && <Check className="cs-spot__check" aria-hidden="true" />}
              </button>
              <span className="cs-spot__label" aria-hidden="true">
                {spot.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
