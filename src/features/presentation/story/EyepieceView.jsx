import { Candle } from '../../../components/presentation/Candle.jsx';

const TICKS = Array.from({ length: 72 }, (_, i) => i);
const BOKEH = [
  [18, 26, 1.4],
  [78, 20, 0.9],
  [70, 74, 1.8],
  [24, 70, 1.1],
  [50, 12, 0.7],
  [88, 52, 1.2],
  [10, 48, 0.8],
];

/**
 * Lo que se ve a través del ocular: un campo circular con nebulosa desenfocada,
 * retícula graduada, lectura de enfoque, la ficha del objeto observado y, en el
 * centro, la vela con su letra.
 *
 * El recorte circular, el desenfoque y las opacidades los escribe la línea de
 * tiempo en el DOM (data-*) en cada fotograma.
 */
export function EyepieceView({ letter }) {
  return (
    <div className="eyepiece" data-eyepiece="">
      <div className="eyepiece__lens" data-eyepiece-lens="">
        <span className="eyepiece__nebula eyepiece__nebula--a" />
        <span className="eyepiece__nebula eyepiece__nebula--b" />
        {BOKEH.map(([x, y, s], i) => (
          <span key={i} className="eyepiece__bokeh" style={{ left: `${x}%`, top: `${y}%`, '--s': s }} />
        ))}
      </div>

      <div className="eyepiece__candle" data-eyepiece-candle="">
        <span className="eyepiece__warmth" />
        <Candle size="xl" monogram={letter} />
      </div>

      <svg className="eyepiece__reticle" viewBox="-100 -100 200 200" data-eyepiece-reticle="" aria-hidden="true">
        <circle r="97" className="reticle__ring" />
        <circle r="90" className="reticle__ring reticle__ring--thin" />
        {TICKS.map((i) => (
          <line
            key={i}
            x1="0"
            y1="-97"
            x2="0"
            y2={i % 6 === 0 ? -88 : -93}
            transform={`rotate(${i * 5})`}
            className={i % 6 === 0 ? 'reticle__tick reticle__tick--major' : 'reticle__tick'}
          />
        ))}
        <line x1="-86" y1="0" x2="-14" y2="0" className="reticle__cross" />
        <line x1="14" y1="0" x2="86" y2="0" className="reticle__cross" />
        <line x1="0" y1="-86" x2="0" y2="-14" className="reticle__cross" />
        <line x1="0" y1="14" x2="0" y2="86" className="reticle__cross" />
        <text x="0" y="-78" textAnchor="middle" className="reticle__label">
          0°
        </text>
        <text x="80" y="3" textAnchor="middle" className="reticle__label">
          90°
        </text>
        <text x="-80" y="3" textAnchor="middle" className="reticle__label">
          270°
        </text>
      </svg>

      <span className="eyepiece__glare" />

      <p className="eyepiece__focus" data-eyepiece-focus="" aria-hidden="true">
        Enfocando… <span data-focus-value="">0</span>%
      </p>

      <dl className="eyepiece__catalog" data-eyepiece-catalog="" aria-hidden="true">
        <div>
          <dt>Objeto</dt>
          <dd>{letter}</dd>
        </div>
        <div>
          <dt>Magnitud</dt>
          <dd>incalculable</dd>
        </div>
        <div>
          <dt>Distancia</dt>
          <dd>aquí</dd>
        </div>
      </dl>
    </div>
  );
}
