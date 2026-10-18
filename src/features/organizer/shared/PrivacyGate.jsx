import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Lock, LockKeyhole } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { useSettings } from '../data/hooks.js';
import { isLocked, lockNow, subscribePrivacy, touchActivity, unlock } from './privacy.js';

/** Estado de bloqueo de un módulo, reactivo a desbloquear/bloquear y a los ajustes. */
export function useLocked(module) {
  const settings = useSettings('privacySettings');
  const [, force] = useState(0);
  useSyncExternalStore(subscribePrivacy, () => isLocked(module, settings));
  // Comprobación periódica del bloqueo por inactividad.
  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 30_000);
    const onActivity = () => touchActivity();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []);
  return { locked: isLocked(module, settings), protectedModule: Boolean(settings.pinHash) && (module === 'journal' ? settings.lockJournal : settings.lockEmotions) };
}

function LockScreen({ title }) {
  const id = useId();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    const result = await unlock(pin);
    setBusy(false);
    setPin('');
    if (result.ok) return;
    setMessage(result.wait ? `Demasiados intentos. Espera ${Math.ceil(result.wait / 1000)} segundos.` : `PIN incorrecto. Te quedan ${result.attemptsLeft} intentos antes de una pausa.`);
  };
  return (
    <form className="org-lock org-panel" onSubmit={submit}>
      <LockKeyhole className="org-lock__icon" aria-hidden="true" />
      <h2 className="org-section__title">{title} está protegido</h2>
      <p className="org-muted">Escribe tu PIN para continuar.</p>
      <label htmlFor={id} className="sr-only">
        PIN
      </label>
      <input
        id={id}
        className="field__control org-lock__input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        autoFocus
      />
      {message && (
        <p className="field__error" role="alert">
          {message}
        </p>
      )}
      <Button type="submit" disabled={!pin || busy}>
        {busy ? 'Comprobando…' : 'Desbloquear'}
      </Button>
      <p className="org-subtle">¿Olvidaste el PIN? Puedes quitarlo en Configuración → Privacidad (los registros se conservan).</p>
    </form>
  );
}

/** Muestra el contenido solo si el módulo no está bloqueado. */
export function PrivacyGate({ module, title, children }) {
  const { locked } = useLocked(module);
  if (locked) return <LockScreen title={title} />;
  return children;
}

export function LockButton({ module }) {
  const { protectedModule } = useLocked(module);
  if (!protectedModule) return null;
  return (
    <Button variant="secondary" icon={Lock} onClick={lockNow}>
      Bloquear
    </Button>
  );
}
