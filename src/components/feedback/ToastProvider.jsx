import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Check, CircleAlert, Info, X } from 'lucide-react';
import { cx } from '../../utils/cx.js';

const ToastContext = createContext(null);
const ICONS = { success: Check, error: CircleAlert, info: Info };
const MAX_VISIBLE = 3;

/**
 * Avisos breves ("Guardado", errores, actualizaciones). Se anuncian a lectores
 * de pantalla mediante una región aria-live que existe desde el inicio.
 * toast({ message, tone, action: { label, onClick }, duration, id })
 * Con `id`, un aviso nuevo reemplaza al anterior con el mismo id (evita repetir "Guardado").
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, tone = 'success', action, duration = 3200, id }) => {
      const toastId = id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      clearTimeout(timers.current.get(toastId));
      setToasts((list) => [...list.filter((item) => item.id !== toastId), { id: toastId, message, tone, action }].slice(-MAX_VISIBLE));
      if (duration !== Infinity) {
        timers.current.set(toastId, setTimeout(() => dismiss(toastId), duration));
      }
      return toastId;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions text">
        {toasts.map((item) => {
          const Icon = ICONS[item.tone] ?? Info;
          return (
            <div key={item.id} className={cx('toast', `toast--${item.tone}`)} role={item.tone === 'error' ? 'alert' : 'status'}>
              <Icon className="toast__icon" aria-hidden="true" />
              <p className="toast__message">{item.message}</p>
              {item.action && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    item.action.onClick();
                    dismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              )}
              <button type="button" className="toast__close" aria-label="Cerrar aviso" onClick={() => dismiss(item.id)}>
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return context;
}
