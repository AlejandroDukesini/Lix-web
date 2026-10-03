/** Descripción de los minijuegos .io (compartida por el manifiesto y la interfaz). */
import { TARGET_MASS, TIME_LIMIT as ORBIT_TIME } from './engine/orbitEngine.js';
import { WIN_SHARE, TIME_LIMIT as TERRITORY_TIME } from './engine/territoryEngine.js';
import { SURVIVE_TIME } from './engine/decoyEngine.js';

export const IO_MODES = [
  {
    id: 'orbit',
    name: 'Órbita',
    kind: 'Recolectar y crecer',
    goal: `recoge partículas y absorbe bots más pequeños hasta alcanzar ${TARGET_MASS} de masa en ${(ORBIT_TIME / 60).toLocaleString('es')} minutos.`,
    rules: [
      'Para absorber a otro debes ser al menos un 20 % más grande.',
      'Cuanto más grande, más lento te mueves.',
      'Si un bot bastante mayor te alcanza, te absorbe.',
    ],
    color: '#7df9ff',
    formatScore: (v) => `${v} masa`,
  },
  {
    id: 'territory',
    name: 'Territorio',
    kind: 'Control del espacio',
    goal: `sal de tu zona, dibuja un recorrido y vuelve para conquistarlo. Domina el ${Math.round(WIN_SHARE * 100)} % del mapa en ${(TERRITORY_TIME / 60).toLocaleString('es')} min.`,
    rules: [
      'Fuera de tu zona dejas un rastro: si alguien lo cruza, quedas eliminado.',
      'Pisar tu propio rastro o salirte del mapa también te elimina.',
      'Cruza el rastro de un bot para eliminarlo.',
    ],
    color: '#ffb703',
    formatScore: (v) => `${v.toLocaleString('es')} %`,
  },
  {
    id: 'decoy',
    name: 'Señuelo',
    kind: 'Supervivencia',
    goal: `esquiva a los drones durante ${SURVIVE_TIME} segundos. Haz que choquen entre ellos para desintegrarlos.`,
    rules: [
      'Cada dron se anuncia con una marca en el borde antes de entrar.',
      'Los drones giran peor que tú: cambia de dirección en el último momento.',
      'Las chispas suman puntos.',
    ],
    color: '#ff4fd8',
    formatScore: (v) => `${v} pts`,
  },
];

export const findMode = (id) => IO_MODES.find((mode) => mode.id === id) ?? null;
