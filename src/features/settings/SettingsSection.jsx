import { useCallback } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

/** Contenedor común de cada bloque de Configuración (tarjeta con título y descripción). */
export function SettingsSection({ id, icon: Icon, title, description, children }) {
  return (
    <Card as="section" id={id} className="settings-section" aria-labelledby={`${id}-title`}>
      <header className="settings-section__header">
        {Icon && (
          <span className="settings-section__icon" aria-hidden="true">
            <Icon />
          </span>
        )}
        <div>
          <h2 id={`${id}-title`} className="settings-section__title">
            {title}
          </h2>
          {description && <p className="settings-section__description">{description}</p>}
        </div>
      </header>
      <div className="settings-section__body">{children}</div>
    </Card>
  );
}

export function SettingsGroup({ title, description, children }) {
  return (
    <div className="settings-group">
      {title && <h3 className="settings-group__title">{title}</h3>}
      {description && <p className="settings-group__description">{description}</p>}
      {children}
    </div>
  );
}

/** Confirmación visual uniforme de "guardado". Un mismo id evita apilar avisos repetidos. */
export function useSavedNotice() {
  const { toast } = useToast();
  return useCallback((message = 'Cambios guardados', action) => toast({ id: 'saved', message, action, duration: 2400 }), [toast]);
}
