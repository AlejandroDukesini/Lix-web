/**
 * Motor de «Resolver casos» (sin interfaz). Las reglas de investigación y
 * deducción viven aquí y se comprueban con datos, no con condiciones sueltas
 * en los componentes.
 *
 * Estado de una investigación: { found: [ids de pistas], interviewed: [ids], attempts, hints, solved }
 * Las declaraciones son pistas con id `t-<personId>`.
 */

export const testimonyId = (personId) => `t-${personId}`;
export const MAX_STARS = 3;

export function createInvestigation() {
  return { found: [], interviewed: [], attempts: 0, hints: 0, solved: false };
}

/** Todas las pistas del caso: objetos, documentos y declaraciones. */
export function allClues(caseData) {
  const testimonies = Object.fromEntries(
    caseData.people.map((person) => [testimonyId(person.id), { title: `Declaración de ${person.name}`, text: person.statement, kind: 'testimony', person: person.id }]),
  );
  return { ...caseData.clues, ...testimonies };
}

export const clueOf = (caseData, id) => allClues(caseData)[id] ?? null;

const withFound = (state, ids) => {
  const fresh = ids.filter((id) => id && !state.found.includes(id));
  return fresh.length ? { ...state, found: [...state.found, ...fresh] } : state;
};

/** Examinar un objeto del escenario. Devuelve el nuevo estado y la pista (y si era nueva). */
export function examine(state, caseData, hotspotId) {
  const spot = caseData.scene.hotspots.find((h) => h.id === hotspotId);
  if (!spot) return { state, clue: null, isNew: false };
  const isNew = !state.found.includes(spot.clue);
  return { state: withFound(state, [spot.clue]), clue: spot.clue, isNew };
}

/** Interrogar a una persona: su declaración (y lo que aporte) pasa al expediente. */
export function interview(state, caseData, personId) {
  if (!caseData.people.some((p) => p.id === personId)) return { state, clues: [] };
  const clues = [testimonyId(personId), caseData.reveals?.[personId]].filter(Boolean);
  const next = withFound(state, clues);
  return {
    state: next.interviewed.includes(personId) ? next : { ...next, interviewed: [...next.interviewed, personId] },
    clues,
  };
}

/** Pistas imprescindibles que aún faltan (para acusar no basta con adivinar). */
export function missingRequirements(state, caseData) {
  return caseData.solution.requires.filter((id) => !state.found.includes(id));
}

export const readyToAccuse = (state, caseData) => missingRequirements(state, caseData).length === 0;

/**
 * Comprobar una conclusión: culpable + prueba que desmiente su declaración.
 * La prueba debe estar en el expediente. Una conclusión incorrecta cuenta un intento
 * y no borra nada de lo investigado.
 */
export function accuse(state, caseData, { culprit, evidence }) {
  if (state.solved) return { state, correct: true };
  if (!readyToAccuse(state, caseData) || !state.found.includes(evidence)) return { state, correct: false, invalid: true };
  const correct = culprit === caseData.solution.culprit && caseData.solution.evidence.includes(evidence);
  return {
    correct,
    state: correct ? { ...state, solved: true } : { ...state, attempts: state.attempts + 1 },
  };
}

/** Siguiente ayuda (gradual). Cada una cuesta una estrella. */
export function takeHint(state, caseData) {
  if (state.hints >= caseData.hints.length) return { state, hint: null };
  return { state: { ...state, hints: state.hints + 1 }, hint: caseData.hints[state.hints] };
}

/** Estrellas al resolver: 3 menos los fallos y las ayudas, con un mínimo de 1. */
export const starsFor = (state) => Math.max(1, MAX_STARS - state.attempts - state.hints);

/** Pistas que se pueden conseguir en el caso (examinando o interrogando). */
export function reachableClues(caseData) {
  const ids = new Set(caseData.scene.hotspots.map((h) => h.clue));
  for (const person of caseData.people) ids.add(testimonyId(person.id));
  for (const id of Object.values(caseData.reveals ?? {})) ids.add(id);
  return ids;
}

/**
 * Comprueba que un caso es coherente y se puede deducir con lo que muestra.
 * Devuelve la lista de problemas (vacía si es válido).
 */
export function validateCase(caseData) {
  const problems = [];
  const clues = allClues(caseData);
  const people = new Set(caseData.people.map((p) => p.id));
  const reachable = reachableClues(caseData);
  const { culprit, evidence, requires } = caseData.solution;

  if (caseData.people.length < 3) problems.push('menos de tres sospechosos');
  if (!people.has(culprit)) problems.push(`culpable desconocido: ${culprit}`);
  for (const spot of caseData.scene.hotspots) if (!clues[spot.clue]) problems.push(`el objeto ${spot.id} apunta a una pista inexistente`);
  for (const [person, clue] of Object.entries(caseData.reveals ?? {})) {
    if (!people.has(person)) problems.push(`revelación de una persona inexistente: ${person}`);
    if (!clues[clue]) problems.push(`revelación de una pista inexistente: ${clue}`);
  }
  // Toda pista definida se puede encontrar (no hay información que nunca se muestre).
  for (const id of Object.keys(caseData.clues)) if (!reachable.has(id)) problems.push(`la pista ${id} no se puede encontrar`);
  for (const id of requires) if (!reachable.has(id)) problems.push(`la pista imprescindible ${id} no se puede encontrar`);
  if (!evidence.length) problems.push('sin prueba decisiva');
  for (const id of evidence) {
    if (!requires.includes(id)) problems.push(`la prueba ${id} debería ser imprescindible`);
    if (clues[id]?.contradicts !== culprit) problems.push(`la prueba ${id} no desmiente al culpable`);
  }
  // La declaración del culpable debe estar en lo imprescindible: hay que leerla para ver la contradicción.
  if (!requires.includes(testimonyId(culprit))) problems.push('hay que interrogar al culpable antes de acusar');
  // Ninguna prueba desmiente a un inocente, y cada inocente tiene una coartada que se puede encontrar.
  for (const [id, clue] of Object.entries(caseData.clues)) {
    if (clue.contradicts && clue.contradicts !== culprit) problems.push(`la pista ${id} desmiente a un inocente`);
    if (clue.alibi === culprit) problems.push(`la pista ${id} da coartada al culpable`);
  }
  for (const person of caseData.people) {
    if (person.id === culprit) continue;
    const alibi = Object.entries(caseData.clues).some(([id, clue]) => clue.alibi === person.id && reachable.has(id));
    if (!alibi) problems.push(`${person.name} no tiene coartada: no se puede descartar`);
  }
  if (caseData.hints.length < 2) problems.push('menos de dos ayudas');
  return problems;
}
