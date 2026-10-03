/** Modos predefinidos de Frente Abierto (fuera del componente para que el manifiesto no lo cargue). */
export const SCENARIOS = Object.freeze([
  { id: 's1', name: 'Primer frente', radius: 3, rivals: 1, difficulty: 'facil', seed: 11 },
  { id: 's2', name: 'Dos frentes', radius: 4, rivals: 2, difficulty: 'facil', seed: 22 },
  { id: 's3', name: 'Rival astuto', radius: 4, rivals: 1, difficulty: 'normal', seed: 33 },
  { id: 's4', name: 'Tres contra ti', radius: 5, rivals: 3, difficulty: 'normal', seed: 44 },
  { id: 's5', name: 'El estratega', radius: 5, rivals: 2, difficulty: 'dificil', seed: 55 },
]);

export const TUTORIAL = Object.freeze({ id: 'tutorial', name: 'Tutorial', radius: 3, rivals: 1, difficulty: 'facil', seed: 7, tutorial: true });
