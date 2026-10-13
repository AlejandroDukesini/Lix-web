/** Hitos de «Bloques que caen» (progreso general del Game Center). */
export const MILESTONES = Object.freeze([
  { id: 'lineas-40', label: '40 líneas en una partida' },
  { id: 'cuatro', label: 'Completar cuatro líneas de golpe' },
  { id: 'nivel-10', label: 'Llegar al nivel 10' },
  { id: 'sprint', label: 'Terminar el contrarreloj de 40 líneas' },
  { id: 'maraton', label: 'Completar el maratón (150 líneas)' },
]);

export function milestonesFor(record) {
  const p = record?.progress ?? {};
  return {
    'lineas-40': (p.maxLinesGame ?? 0) >= 40,
    cuatro: (p.tetrises ?? 0) > 0,
    'nivel-10': (p.maxLevel ?? 0) >= 10,
    sprint: (p.wins?.sprint ?? 0) > 0,
    maraton: (p.wins?.maraton ?? 0) > 0,
  };
}
