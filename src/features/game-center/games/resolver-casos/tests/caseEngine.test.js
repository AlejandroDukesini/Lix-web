import { describe, expect, it } from 'vitest';
import { CASES, findCase } from '../cases/cases.js';
import {
  accuse,
  allClues,
  createInvestigation,
  examine,
  interview,
  missingRequirements,
  readyToAccuse,
  starsFor,
  takeHint,
  testimonyId,
  validateCase,
} from '../engine/caseEngine.js';

/** Investiga todo: examina cada objeto e interroga a cada persona. */
function investigateAll(caseData) {
  let state = createInvestigation();
  for (const spot of caseData.scene.hotspots) state = examine(state, caseData, spot.id).state;
  for (const person of caseData.people) state = interview(state, caseData, person.id).state;
  return state;
}

describe('casos', () => {
  it('hay al menos seis casos con dificultad progresiva', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < CASES.length; i += 1) expect(CASES[i].difficulty).toBeGreaterThanOrEqual(CASES[i - 1].difficulty);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });

  it.each(CASES.map((c) => [c.title, c]))('«%s» es coherente y deducible', (_, caseData) => {
    expect(validateCase(caseData)).toEqual([]);
  });

  it.each(CASES.map((c) => [c.title, c]))('«%s» tiene una única conclusión correcta', (_, caseData) => {
    const state = investigateAll(caseData);
    expect(readyToAccuse(state, caseData)).toBe(true);
    const correct = [];
    for (const person of caseData.people) {
      for (const evidence of state.found) {
        if (accuse(state, caseData, { culprit: person.id, evidence }).correct) correct.push([person.id, evidence]);
      }
    }
    expect(correct).toEqual(caseData.solution.evidence.map((e) => [caseData.solution.culprit, e]));
  });
});

describe('investigación', () => {
  const caseData = findCase('pastel');

  it('examinar un objeto añade su pista una sola vez', () => {
    let { state, clue, isNew } = examine(createInvestigation(), caseData, 'suelo');
    expect(clue).toBe('huellas');
    expect(isNew).toBe(true);
    ({ state, isNew } = examine(state, caseData, 'suelo'));
    expect(isNew).toBe(false);
    expect(state.found).toEqual(['huellas']);
  });

  it('interrogar añade la declaración y lo que la persona aporte', () => {
    const { state, clues } = interview(createInvestigation(), caseData, 'lucia');
    expect(clues).toEqual(['t-lucia', 'videollamada']);
    expect(state.interviewed).toEqual(['lucia']);
    expect(allClues(caseData)[testimonyId('lucia')].kind).toBe('testimony');
  });

  it('no se puede acusar sin las pistas imprescindibles (no basta con adivinar)', () => {
    let state = examine(createInvestigation(), caseData, 'suelo').state;
    expect(readyToAccuse(state, caseData)).toBe(false);
    expect(missingRequirements(state, caseData)).toEqual(['botas', 't-tomas']);
    const attempt = accuse(state, caseData, { culprit: 'tomas', evidence: 'huellas' });
    expect(attempt).toMatchObject({ correct: false, invalid: true });
    expect(attempt.state.attempts).toBe(0);
    state = examine(state, caseData, 'puerta').state;
    state = interview(state, caseData, 'tomas').state;
    expect(readyToAccuse(state, caseData)).toBe(true);
  });

  it('una conclusión equivocada cuenta un intento y no borra lo investigado', () => {
    const state = investigateAll(caseData);
    const wrong = accuse(state, caseData, { culprit: 'bruno', evidence: 'huellas' });
    expect(wrong.correct).toBe(false);
    expect(wrong.state.attempts).toBe(1);
    expect(wrong.state.found).toEqual(state.found);
    // El culpable correcto con una prueba que no lo desmiente tampoco vale.
    expect(accuse(wrong.state, caseData, { culprit: 'tomas', evidence: 'migas' }).correct).toBe(false);
  });

  it('la prueba tiene que estar en el expediente', () => {
    const state = { ...investigateAll(caseData), found: investigateAll(caseData).found.filter((id) => id !== 'huellas') };
    expect(accuse(state, caseData, { culprit: 'tomas', evidence: 'huellas' }).correct).toBe(false);
  });

  it('las ayudas son graduales y cuestan estrellas (mínimo una)', () => {
    let state = investigateAll(caseData);
    expect(starsFor(state)).toBe(3);
    let hint;
    ({ state, hint } = takeHint(state, caseData));
    expect(hint).toBe(caseData.hints[0]);
    ({ state, hint } = takeHint(state, caseData));
    expect(hint).toBe(caseData.hints[1]);
    expect(takeHint(state, caseData).hint).toBeNull();
    state = accuse(state, caseData, { culprit: 'lucia', evidence: 'huellas' }).state;
    expect(starsFor(state)).toBe(1);
    const solved = accuse(state, caseData, { culprit: 'tomas', evidence: 'huellas' });
    expect(solved.correct).toBe(true);
    expect(solved.state.solved).toBe(true);
  });
});

describe('validador', () => {
  it('detecta casos sin información suficiente', () => {
    const base = findCase('pastel');
    const noAlibi = { ...base, clues: { ...base.clues, ticket: { ...base.clues.ticket, alibi: undefined } } };
    expect(validateCase(noAlibi)).toContain('Bruno no tiene coartada: no se puede descartar');
    const hidden = { ...base, clues: { ...base.clues, secreto: { title: 'x', text: 'x', kind: 'object' } } };
    expect(validateCase(hidden)).toContain('la pista secreto no se puede encontrar');
    const unfair = { ...base, solution: { ...base.solution, evidence: ['migas'] } };
    expect(validateCase(unfair)).toContain('la prueba migas no desmiente al culpable');
  });
});
