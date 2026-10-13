import { CookingGame } from './CookingGame.jsx';
import { CakeVisual } from './components/FoodVisuals.jsx';
import { PASTELERIA } from './recipes/recipes.js';
import { TEXTS } from './texts.js';

/** Pastelería: juego de pedidos sobre el motor común de cocina. */
export default function Pasteleria() {
  return <CookingGame gameId="pasteleria" recipe={PASTELERIA} Visual={CakeVisual} texts={TEXTS['pasteleria']} />;
}
