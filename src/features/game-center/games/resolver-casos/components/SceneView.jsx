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

/** Decorados originales de cada lugar (SVG ligero, 160×100). Son ambientación: lo interactivo va encima. */
function Backdrop({ kind }) {
  const common = (
    <defs>
      <linearGradient id="cs-light" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
  switch (kind) {
    case 'kitchen':
      return (
        <>
          {common}
          <rect width="160" height="62" fill="#f4dfbf" />
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={i * 10} y="30" width="9.4" height="9.4" fill={i % 2 ? '#e9f1f4' : '#d6e7ee'} />
          ))}
          <rect y="62" width="160" height="38" fill="#c98f5d" />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={i * 20} y="62" width="20" height="38" fill={i % 2 ? '#bd8452' : '#c98f5d'} />
          ))}
          <rect x="62" y="8" width="36" height="20" rx="2" fill="#bfe3ff" stroke="#fff" strokeWidth="2" />
          <rect x="4" y="20" width="22" height="48" rx="2" fill="#8a5a34" />
          <rect x="52" y="50" width="56" height="5" rx="2" fill="#7a4c2a" />
          <rect x="56" y="55" width="4" height="22" fill="#7a4c2a" />
          <rect x="100" y="55" width="4" height="22" fill="#7a4c2a" />
          <rect x="118" y="40" width="42" height="26" fill="#e6e1d8" />
          <rect x="118" y="38" width="42" height="4" fill="#a7a29a" />
        </>
      );
    case 'garage':
      return (
        <>
          {common}
          <rect width="160" height="66" fill="#c9cdd6" />
          <rect y="66" width="160" height="34" fill="#7d828e" />
          <rect x="96" y="6" width="54" height="58" fill="#9aa1ad" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x="96" y={8 + i * 6.3} width="54" height="1.4" fill="#7f8692" />
          ))}
          <rect x="28" y="56" width="44" height="5" rx="1" fill="#8b5e34" />
          <rect x="31" y="61" width="3" height="16" fill="#6b4524" />
          <rect x="66" y="61" width="3" height="16" fill="#6b4524" />
          <circle cx="54" cy="84" r="9" fill="none" stroke="#2c2c34" strokeWidth="2.5" />
          <circle cx="82" cy="84" r="9" fill="none" stroke="#2c2c34" strokeWidth="2.5" />
          <rect x="10" y="26" width="16" height="3" rx="1" fill="#4b4f5c" />
        </>
      );
    case 'museum':
      return (
        <>
          {common}
          <rect width="160" height="70" fill="#7a2f3c" />
          <rect y="70" width="160" height="30" fill="#a8774a" />
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={i * 16} y="70" width="1" height="30" fill="#8d6038" />
          ))}
          <rect x="62" y="12" width="36" height="26" fill="#d9b25b" />
          <rect x="65" y="15" width="30" height="20" fill="#3b6ea8" />
          <circle cx="80" cy="25" r="5" fill="#f2c94c" />
          <rect x="18" y="16" width="20" height="16" fill="#d9b25b" />
          <rect x="122" y="16" width="20" height="16" fill="#d9b25b" />
          <rect x="60" y="80" width="40" height="5" rx="1" fill="#4a2d1e" />
          <rect y="66" width="160" height="4" fill="#5d2430" />
        </>
      );
    case 'office':
      return (
        <>
          {common}
          <rect width="160" height="64" fill="#dce8f2" />
          <rect y="64" width="160" height="36" fill="#9fb0c2" />
          <rect x="112" y="10" width="38" height="24" rx="2" fill="#c8a272" />
          {[[116, 14], [128, 18], [140, 13], [120, 24]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="8" height="7" fill="#fff8d6" />
          ))}
          <rect x="22" y="56" width="70" height="5" rx="1" fill="#5c6b7c" />
          <rect x="26" y="61" width="3" height="22" fill="#4a5766" />
          <rect x="85" y="61" width="3" height="22" fill="#4a5766" />
          <rect x="6" y="40" width="10" height="24" rx="2" fill="#5aa469" />
          <rect x="8" y="64" width="6" height="8" fill="#8a6a4a" />
        </>
      );
    case 'hotel':
      return (
        <>
          {common}
          <rect width="160" height="64" fill="#efe1cf" />
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={i * 10 + 4} y="0" width="2" height="64" fill="#e4d2bb" />
          ))}
          <rect y="64" width="160" height="36" fill="#8c3b4b" />
          <rect x="4" y="18" width="20" height="46" rx="1" fill="#6e4a33" />
          <rect x="84" y="44" width="56" height="20" rx="3" fill="#ffffff" />
          <rect x="84" y="38" width="56" height="8" rx="3" fill="#d8c8e8" />
          <rect x="138" y="30" width="6" height="34" rx="1" fill="#6e4a33" />
          <rect x="60" y="52" width="20" height="14" rx="1" fill="#6e4a33" />
          <ellipse cx="80" cy="88" rx="44" ry="7" fill="#a5546a" />
        </>
      );
    case 'lighthouse':
      return (
        <>
          {common}
          <rect width="160" height="100" fill="#8f9aa6" />
          {Array.from({ length: 6 }, (_, r) =>
            Array.from({ length: 9 }, (_, c) => (
              <rect key={`${r}-${c}`} x={c * 18 + (r % 2 ? 9 : 0) - 4} y={r * 11} width="17" height="10" rx="1.5" fill={r % 2 ? '#9aa5b1' : '#a5afba'} />
            )),
          )}
          <rect y="66" width="160" height="34" fill="#5e5348" />
          <rect x="86" y="10" width="26" height="30" rx="13" fill="#1d2a3a" stroke="#c9d2dc" strokeWidth="2" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={90 + i * 4} y1="16" x2={86 + i * 4} y2="34" stroke="#7fb2e0" strokeWidth="0.8" />
          ))}
          <rect x="30" y="58" width="34" height="4" rx="1" fill="#7a5a3a" />
          <path d="M126 100 L126 70 L140 70 L140 60 L152 60 L152 100 Z" fill="#6a5d50" />
        </>
      );
    default:
      return <rect width="160" height="100" fill="#ccc" />;
  }
}

/** Escenario con los objetos que se pueden examinar. */
export function SceneView({ caseData, found, lastClue, onExamine }) {
  return (
    <div className="cs-scene">
      <svg className="cs-scene__backdrop" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <Backdrop kind={caseData.scene.kind} />
        <rect width="160" height="100" fill="url(#cs-light)" />
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
