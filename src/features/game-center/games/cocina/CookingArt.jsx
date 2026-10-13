/** Ilustraciones de portada de los juegos de cocina: la comanda junto al plato terminado. */
import { CakeVisual, IceCreamVisual, PizzaVisual } from './components/FoodVisuals.jsx';

function Scene({ className, id, from, to, children, lines }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ck-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#ck-bg-${id})`} />
      <rect x="0" y="196" width="400" height="54" fill="#000" opacity="0.12" />
      {/* Comanda */}
      <g transform="translate(36 40) rotate(-6)">
        <rect width="110" height="146" rx="8" fill="#fffdf6" />
        <rect y="0" width="110" height="22" rx="8" fill="#ffd166" />
        <text x="12" y="16" fontSize="11" fontWeight="700" fontFamily="system-ui" fill="#5b3a12">
          Pedido
        </text>
        {lines.map((line, i) => (
          <text key={line} x="12" y={42 + i * 18} fontSize="10.5" fontFamily="system-ui" fill="#4a3a48">
            {line}
          </text>
        ))}
      </g>
      {children}
    </svg>
  );
}

export function IceCreamArt({ className }) {
  return (
    <Scene className={className} id="hel" from="#ffd6e8" to="#9fd8ff" lines={['Cono', '1. Vainilla', '2. Chocolate', '3. Fresa', 'Salsa: caramelo', '+ Cereza']}>
      <IceCreamVisual spec={{ recipiente: 'cono', bolas: ['vainilla', 'chocolate', 'fresa'], salsa: 'caramelo', toppings: ['cereza', 'chispas'] }} x="200" y="6" width="190" height="238" />
    </Scene>
  );
}

export function PizzaArt({ className }) {
  return (
    <Scene className={className} id="piz" from="#ffd29a" to="#d8402b" lines={['Grande', 'Masa clásica', 'Tomate', 'Mozzarella', 'Pepperoni', 'Champiñones']}>
      <PizzaVisual spec={{ tamano: 'grande', masa: 'clasica', salsa: 'tomate', queso: 'mozzarella', ingredientes: [{ id: 'pepperoni', place: 'toda' }, { id: 'champinones', place: 'izq' }, { id: 'aceitunas', place: 'der' }], coccion: 'media' }} x="185" y="15" width="210" height="210" />
    </Scene>
  );
}

export function CakeArt({ className }) {
  return (
    <Scene className={className} id="pas" from="#f9e1ff" to="#b48cff" lines={['Redondo', '1. Chocolate', '2. Vainilla', 'Relleno de fresa', 'Cobertura fresa', '«Un año más»']}>
      <CakeVisual spec={{ forma: 'redondo', capas: ['chocolate', 'vainilla'], relleno: 'fresa', cobertura: 'fresa', decoracion: ['fresas', 'velas'], mensaje: 'un-ano-mas' }} x="180" y="10" width="215" height="225" />
    </Scene>
  );
}
