import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from './Button.jsx';
import { TextField } from './TextField.jsx';
import { cx } from '../../utils/cx.js';

/**
 * Diálogo modal sobre <dialog> nativo: el navegador gestiona la captura del
 * foco, la tecla Escape, el fondo inerte y la devolución del foco al cerrar.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', className }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx('dialog', `dialog--${size}`, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clic en el fondo (el propio <dialog>, fuera del panel) cierra el diálogo.
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            <IconButton icon={X} label="Cerrar" size="sm" onClick={onClose} />
          </header>
          {description && (
            <p id={descriptionId} className="dialog__description">
              {description}
            </p>
          )}
          {children && <div className="dialog__body">{children}</div>}
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/**
 * Confirmación de acciones sensibles. Con `requireText`, la persona debe
 * escribir esa palabra exacta para habilitar el botón (acciones irreversibles).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  requireText,
  onConfirm,
  onCancel,
  children,
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = Boolean(requireText) && typed.trim().toUpperCase() !== requireText.toUpperCase();

  useEffect(() => {
    if (!open) {
      setTyped('');
      setBusy(false);
    }
  }, [open]);

  const confirm = async () => {
    if (blocked || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={confirm} disabled={blocked || busy}>
            {busy ? 'Un momento…' : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {requireText && (
        <TextField
          label={`Escribe ${requireText} para confirmar`}
          value={typed}
          onChange={setTyped}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </Dialog>
  );
}
