import { CookingGame } from './CookingGame.jsx';
import { IceCreamVisual } from './components/FoodVisuals.jsx';
import { HELADERIA } from './recipes/recipes.js';
import { TEXTS } from './texts.js';

/** Heladería: juego de pedidos sobre el motor común de cocina. */
export default function Heladeria() {
  return <CookingGame gameId="heladeria" recipe={HELADERIA} Visual={IceCreamVisual} texts={TEXTS['heladeria']} />;
}
