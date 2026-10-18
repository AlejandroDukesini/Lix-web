import { createContext, useContext } from 'react';

/** Acciones de la página de finanzas que cualquier vista puede abrir (formulario de movimiento). */
export const FinanceActions = createContext({ openTransaction: () => {} });

export const useFinanceActions = () => useContext(FinanceActions);
