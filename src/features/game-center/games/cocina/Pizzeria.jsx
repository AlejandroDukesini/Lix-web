import { CookingGame } from './CookingGame.jsx';
import { PizzaVisual } from './components/FoodVisuals.jsx';
import { PIZZERIA } from './recipes/recipes.js';
import { TEXTS } from './texts.js';

/** Pizzería: juego de pedidos sobre el motor común de cocina. */
export default function Pizzeria() {
  return <CookingGame gameId="pizzeria" recipe={PIZZERIA} Visual={PizzaVisual} texts={TEXTS['pizzeria']} />;
}
