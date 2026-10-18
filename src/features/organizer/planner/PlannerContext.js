import { createContext, useContext } from 'react';

/** Formularios y detalle del calendario que cualquier vista puede abrir. */
export const PlannerActions = createContext({
  openEvent: () => {},
  openTask: () => {},
  openActivity: () => {},
  openSubject: () => {},
  openItem: () => {},
});

export const usePlannerActions = () => useContext(PlannerActions);
