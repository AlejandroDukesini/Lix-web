/**
 * Registro central de juegos.
 *
 * La biblioteca, las tarjetas, la búsqueda, las estadísticas y las rutas se
 * construyen a partir de esta lista. Cada juego vive en su propia carpeta
 * (games/<id>/) y se describe con un manifiesto:
 *
 *   id, title, tagline, description     textos
 *   phase                               fase de la hoja de ruta en la que llegó (1 por defecto)
 *   categories                          ids de registry/categories.js
 *   Art                                 ilustración (componente SVG ligero)
 *   palette { a, b }                    colores de identidad del juego
 *   facts, objective, howTo, controls,  pantalla de presentación
 *   difficulty
 *   load()                              import() del componente del juego (carga diferida)
 *   progress(record) → { done, total }  hitos para el progreso general
 *   highlight(record) → string | null   resumen para la tarjeta
 *
 * Para añadir un juego (fases futuras): crea games/<id>/ con manifest.js y su
 * componente por defecto, e inclúyelo aquí. No hace falta tocar el núcleo.
 */
import { lazy } from 'react';
import { aquaparkManifest } from '../games/aquapark/manifest.js';
import { ioGamesManifest } from '../games/io-games/manifest.js';
import { logicGridManifest } from '../games/logic-grid/manifest.js';
import { chessManifest } from '../games/chess/manifest.js';
import { tunnelRunnerManifest } from '../games/tunnel-runner/manifest.js';
import { chickenCrossingManifest } from '../games/cruce-del-pollo/manifest.js';
import { resolverCasosManifest } from '../games/resolver-casos/manifest.js';
import { sudokusManifest } from '../games/sudokus/manifest.js';
import { aparcarManifest } from '../games/aparcar/manifest.js';
import { despejarManifest } from '../games/despejar/manifest.js';
import { hexastackManifest } from '../games/hexastack/manifest.js';
import { trafficRiderManifest } from '../games/traffic-rider/manifest.js';
import { frenteAbiertoManifest } from '../games/frente-abierto/manifest.js';
import { saltosDeLumiManifest } from '../games/saltos-de-lumi/manifest.js';

const MANIFESTS = [
  aquaparkManifest,
  ioGamesManifest,
  logicGridManifest,
  chessManifest,
  tunnelRunnerManifest,
  // Fase 2
  chickenCrossingManifest,
  resolverCasosManifest,
  sudokusManifest,
  aparcarManifest,
  despejarManifest,
  // Fase 3
  hexastackManifest,
  trafficRiderManifest,
  frenteAbiertoManifest,
  saltosDeLumiManifest,
];

export const GAMES = Object.freeze(
  MANIFESTS.map((manifest) => Object.freeze({ phase: 1, ...manifest, Component: lazy(manifest.load) })),
);

export const findGame = (id) => GAMES.find((game) => game.id === id) ?? null;

/** Filtro local e inmediato por nombre, descripción y categoría. */
export function filterGames(games, { query = '', category = 'all' } = {}, categoryLabel = (id) => id) {
  const normalize = (text) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  const needle = normalize(query);
  return games.filter((game) => {
    if (category !== 'all' && !game.categories.includes(category)) return false;
    if (!needle) return true;
    const haystack = normalize([game.title, game.tagline, ...game.categories.map(categoryLabel)].join(' '));
    return needle.split(/\s+/).every((word) => haystack.includes(word));
  });
}
