/**
 * Modo online: versiones originales de los juegos, servidas por su proveedor.
 *
 * Es configuración pura (sin React) para que también la lea el build: la CSP
 * (`frame-src`) se genera a partir de los orígenes de inserción verificados de
 * aquí, así que nunca se abre la puerta a dominios que no estén en esta lista.
 *
 * Dos métodos de integración:
 *   'embed'     el proveedor AUTORIZA insertar el juego en un iframe y la URL de
 *               inserción se ha comprobado. Se juega dentro de la app (OnlineGameFrame).
 *   'external'  el proveedor no permite insertarlo: se abre su página oficial en
 *               otra pestaña. Nunca se intenta enmarcar ni sortear sus restricciones.
 *
 * Cada fuente corresponde a UN juego concreto, con su URL exacta comprobada
 * (no se construyen URLs a partir del nombre). Para añadir otra, ver README →
 * «Añadir un juego online».
 */

export const PROVIDERS = Object.freeze({
  crazygames: Object.freeze({
    id: 'crazygames',
    name: 'CrazyGames',
    // Páginas oficiales que se pueden abrir en otra pestaña.
    linkOrigins: Object.freeze(['https://www.crazygames.com']),
    // Ninguno: sus Términos (art. 6.3 C e I, abril de 2026) no autorizan dar acceso a
    // los juegos desde otros sitios, sus páginas responden `X-Frame-Options: SAMEORIGIN`
    // y la ruta /embed/ responde 401 (comprobado el 3 de octubre de 2026).
    embedOrigins: Object.freeze([]),
  }),
  poki: Object.freeze({
    id: 'poki',
    name: 'Poki',
    linkOrigins: Object.freeze(['https://poki.com']),
    // Ninguno: sus normas (poki.com/en/privacy/our-website-rules) prohíben «publicly display…
    // republish… transmit or distribute» su material sin permiso escrito, y sus páginas
    // responden `frame-ancestors https://*.poki.io` (comprobado el 3 de octubre de 2026).
    embedOrigins: Object.freeze([]),
  }),
  sudokucom: Object.freeze({
    id: 'sudokucom',
    name: 'Sudoku.com',
    linkOrigins: Object.freeze(['https://sudoku.com']),
    // Ninguno: responde `X-Frame-Options: SAMEORIGIN` y no ofrece inserción (3 de octubre de 2026).
    embedOrigins: Object.freeze([]),
  }),
  openfront: Object.freeze({
    id: 'openfront',
    name: 'OpenFront.io',
    linkOrigins: Object.freeze(['https://openfront.io']),
    // Ninguno: su CSP `frame-ancestors` solo admite su propio dominio y algunos portales
    // concretos (CrazyGames, Poki, itch.io…), no otras aplicaciones (comprobado el 3 de octubre de 2026).
    embedOrigins: Object.freeze([]),
  }),
});

const CRAZYGAMES_REASON = 'CrazyGames no permite insertar sus juegos en otras aplicaciones, así que se abre su página oficial.';
const POKI_REASON = 'Poki no permite mostrar sus juegos dentro de otras aplicaciones, así que se abre su página oficial.';

/** Permisos de iframe que una fuente puede pedir (el resto se descarta). */
export const ALLOWED_IFRAME_PERMISSIONS = Object.freeze(['fullscreen', 'autoplay', 'gamepad']);

export const ONLINE_SOURCES = Object.freeze({
  aquapark: Object.freeze({
    gameId: 'aquapark',
    provider: 'crazygames',
    method: 'external',
    title: 'Aquapark.io',
    developer: 'Voodoo',
    url: 'https://www.crazygames.com/game/aquapark-io-yky',
    verifiedOn: '2026-10-03',
    devices: 'Escritorio, móvil y tableta · horizontal o vertical',
    reason: CRAZYGAMES_REASON,
  }),
  'cruce-del-pollo': Object.freeze({
    gameId: 'cruce-del-pollo',
    provider: 'crazygames',
    method: 'external',
    title: 'Go Chicken Go!',
    developer: 'RAVALMATIC',
    url: 'https://www.crazygames.com/game/go-chicken-go',
    verifiedOn: '2026-10-03',
    devices: 'Navegador de escritorio, según CrazyGames',
    reason: `${CRAZYGAMES_REASON} CrazyGames lo indica para navegador de escritorio.`,
  }),
  sudokus: Object.freeze({
    gameId: 'sudokus',
    provider: 'sudokucom',
    method: 'external',
    title: 'Sudoku.com',
    developer: 'Easybrain',
    url: 'https://sudoku.com/',
    verifiedOn: '2026-10-03',
    devices: 'Navegador de escritorio y móvil',
    reason: 'Sudoku.com no permite mostrarse dentro de otras aplicaciones (bloquea los iframes), así que se abre su página oficial.',
  }),
  aparcar: Object.freeze({
    gameId: 'aparcar',
    provider: 'poki',
    method: 'external',
    title: 'Extreme Car Parking',
    developer: 'QKY Games',
    url: 'https://poki.com/es/g/extreme-car-parking',
    verifiedOn: '2026-10-03',
    devices: 'Escritorio, móvil y tableta',
    reason: POKI_REASON,
  }),
  despejar: Object.freeze({
    gameId: 'despejar',
    provider: 'poki',
    method: 'external',
    title: 'Car Parking Jam',
    developer: 'Refold',
    url: 'https://poki.com/es/g/car-parking-jam',
    verifiedOn: '2026-10-03',
    devices: 'Escritorio, móvil y tableta',
    reason: POKI_REASON,
  }),
  hexastack: Object.freeze({
    gameId: 'hexastack',
    provider: 'crazygames',
    method: 'external',
    title: 'Hexa Stack',
    developer: 'SOFTGAMES',
    url: 'https://www.crazygames.com/game/hexa-stack',
    verifiedOn: '2026-10-03',
    devices: 'Escritorio, móvil y tableta',
    reason: CRAZYGAMES_REASON,
  }),
  'traffic-rider': Object.freeze({
    gameId: 'traffic-rider',
    provider: 'crazygames',
    method: 'external',
    title: 'Traffic Rider',
    developer: 'skgames',
    url: 'https://www.crazygames.com/game/traffic-rider-vvq',
    verifiedOn: '2026-10-03',
    devices: 'Escritorio, móvil y tableta',
    reason: CRAZYGAMES_REASON,
  }),
  'frente-abierto': Object.freeze({
    gameId: 'frente-abierto',
    provider: 'openfront',
    method: 'external',
    title: 'OpenFront.io',
    developer: 'OpenFront (código abierto)',
    url: 'https://openfront.io/',
    verifiedOn: '2026-10-03',
    devices: 'Navegador · multijugador en tiempo real con otras personas',
    reason: 'OpenFront.io solo permite mostrarse en su web y en algunos portales concretos, así que se abre su página oficial. Es multijugador en tiempo real; la versión offline de aquí es por turnos contra una IA local.',
  }),
});

/**
 * Juegos cuya referencia no tiene versión online jugable en un navegador: se
 * explica en su pantalla en lugar de mostrar una opción que no existe.
 */
export const ONLINE_UNAVAILABLE = Object.freeze({
  'resolver-casos':
    'Case Hunter, el juego en el que se inspira, es una app para móvil (EYEWIND) sin versión para navegador. Aquí solo existe la versión offline.',
  'saltos-de-lumi':
    'Es un juego original de esta app, solo inspirado en el género de plataformas: no existe una versión online oficial. Se juega aquí, también sin conexión.',
});

function originOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.origin : null;
  } catch {
    return null;
  }
}

/**
 * ¿La fuente es utilizable tal cual? Comprueba método, proveedor conocido,
 * HTTPS y que el origen esté en la lista permitida de ESE proveedor y método.
 * `providers` solo se cambia en pruebas.
 */
export function isTrustedSource(source, providers = PROVIDERS) {
  if (!source || typeof source.url !== 'string') return false;
  const provider = providers[source.provider];
  if (!provider) return false;
  const origin = originOf(source.url);
  if (!origin) return false;
  // La página oficial alternativa de una fuente 'embed' también debe ser un origen conocido.
  if (source.officialUrl !== undefined && !provider.linkOrigins.includes(originOf(source.officialUrl))) return false;
  if (source.method === 'embed') return provider.embedOrigins.includes(origin);
  if (source.method === 'external') return provider.linkOrigins.includes(origin);
  return false;
}

/** Fuente online verificada de un juego, o null si no tiene (o si su configuración no es válida). */
export function onlineSourceFor(gameId, sources = ONLINE_SOURCES, providers = PROVIDERS) {
  const source = sources[gameId];
  return isTrustedSource(source, providers) ? { ...source, providerName: providers[source.provider].name } : null;
}

/** Permisos del iframe: solo los de la lista permitida, en formato del atributo `allow`. */
export function iframeAllow(permissions = []) {
  return permissions.filter((p) => ALLOWED_IFRAME_PERMISSIONS.includes(p)).join('; ');
}

/**
 * Orígenes que necesita `frame-src` en la CSP: los de las fuentes 'embed'
 * válidas. Vacío hoy (ningún proveedor configurado autoriza la inserción).
 */
export function embedOrigins(sources = ONLINE_SOURCES, providers = PROVIDERS) {
  const origins = Object.values(sources)
    .filter((source) => source.method === 'embed' && isTrustedSource(source, providers))
    .map((source) => originOf(source.url));
  return [...new Set(origins)].sort();
}
