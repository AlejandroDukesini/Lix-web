import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../components/common/Dialog.jsx';
import { Switch } from '../../../components/common/Switch.jsx';
import { TextField } from '../../../components/common/TextField.jsx';
import { useOrganizerStatus, useRunner, useSettings } from '../../organizer/data/hooks.js';
import { saveSettings } from '../../organizer/data/store.js';
import { cryptoAvailable, PIN_PATTERN, removePin, setPin, unlock } from '../../organizer/shared/privacy.js';
import { SettingsGroup, SettingsSection } from '../SettingsSection.jsx';

/**
 * PIN del diario personal y del diario emocional. Se explica con claridad que es una
 * barrera frente a miradas casuales y no un cifrado de los datos.
 */
export function PrivacySection() {
  const status = useOrganizerStatus();
  const settings = useSettings('privacySettings');
  const run = useRunner();
  const [current, setCurrent] = useState('');
  const [pin, setPinValue] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [forget, setForget] = useState(false);
  const hasPin = Boolean(settings.pinHash);

  const savePin = async () => {
    setError(null);
    if (hasPin) {
      const check = await unlock(current);
      if (!check.ok) {
        setError(check.wait ? 'Demasiados intentos; espera un momento.' : 'El PIN actual no es correcto.');
        return;
      }
    }
    if (!PIN_PATTERN.test(pin)) return setError('El PIN debe tener entre 4 y 8 números.');
    if (pin !== repeat) return setError('Los dos PIN no coinciden.');
    const { ok } = await run(() => setPin(pin), { success: hasPin ? 'PIN cambiado' : 'PIN activado' });
    if (ok) {
      setCurrent('');
      setPinValue('');
      setRepeat('');
    }
  };

  const quitPin = async () => {
    setError(null);
    const check = await unlock(current);
    if (!check.ok) return setError(check.wait ? 'Demasiados intentos; espera un momento.' : 'El PIN actual no es correcto.');
    await run(removePin, { success: 'PIN quitado' });
    setCurrent('');
  };

  return (
    <SettingsSection
      id="privacidad"
      icon={LockKeyhole}
      title="Privacidad de los diarios"
      description="Un PIN para el diario personal y el diario emocional en este dispositivo."
    >
      <p className="settings-note">
        El PIN impide que alguien que tome el dispositivo lea tus diarios con solo abrir la app. <strong>No cifra los datos</strong>: siguen guardados en el
        navegador y una persona con conocimientos técnicos y acceso a él podría leerlos. Tampoco protege las copias de seguridad que descargues. El PIN no
        se guarda en ningún sitio, solo una huella que no permite recuperarlo.
      </p>
      {!status.ready ? null : !cryptoAvailable() ? (
        <p className="settings-note">Este navegador no permite crear un PIN de forma segura (se necesita HTTPS o localhost).</p>
      ) : (
        <>
          <SettingsGroup title={hasPin ? 'Cambiar o quitar el PIN' : 'Activar un PIN'}>
            {hasPin && <TextField label="PIN actual" type="password" inputMode="numeric" value={current} onChange={(v) => setCurrent(v.replace(/\D/g, ''))} maxLength={8} autoComplete="off" />}
            <TextField label={hasPin ? 'PIN nuevo (4 a 8 números)' : 'PIN (4 a 8 números)'} type="password" inputMode="numeric" value={pin} onChange={(v) => setPinValue(v.replace(/\D/g, ''))} maxLength={8} autoComplete="new-password" />
            <TextField label="Repite el PIN" type="password" inputMode="numeric" value={repeat} onChange={(v) => setRepeat(v.replace(/\D/g, ''))} maxLength={8} autoComplete="new-password" error={error} />
            <div className="settings-actions settings-actions--start">
              <Button onClick={savePin} disabled={!pin}>
                {hasPin ? 'Cambiar PIN' : 'Activar PIN'}
              </Button>
              {hasPin && (
                <>
                  <Button variant="secondary" onClick={quitPin} disabled={!current}>
                    Quitar el PIN
                  </Button>
                  <Button variant="ghost" onClick={() => setForget(true)}>
                    Olvidé el PIN
                  </Button>
                </>
              )}
            </div>
          </SettingsGroup>
          {hasPin && (
            <SettingsGroup title="Qué se protege">
              <Switch label="Diario personal" checked={settings.lockJournal} onChange={(lockJournal) => run(() => saveSettings('privacySettings', { lockJournal }), { success: 'Preferencia guardada' })} />
              <Switch label="Diario emocional" checked={settings.lockEmotions} onChange={(lockEmotions) => run(() => saveSettings('privacySettings', { lockEmotions }), { success: 'Preferencia guardada' })} />
              <label className="field">
                <span className="field__label">Volver a bloquear tras</span>
                <select
                  className="field__control"
                  value={settings.autoLockMinutes}
                  onChange={(e) => run(() => saveSettings('privacySettings', { autoLockMinutes: Number(e.target.value) }), { success: 'Preferencia guardada' })}
                >
                  {[1, 2, 5, 10, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} {m === 1 ? 'minuto' : 'minutos'} sin actividad
                    </option>
                  ))}
                </select>
              </label>
            </SettingsGroup>
          )}
        </>
      )}
      <ConfirmDialog
        open={forget}
        title="¿Quitar el PIN sin conocerlo?"
        description="Como el PIN no cifra nada, se puede quitar: tus diarios se conservan intactos. Después podrás crear uno nuevo."
        confirmLabel="Quitar el PIN"
        requireText="QUITAR"
        onConfirm={async () => {
          await run(removePin, { success: 'PIN quitado' });
          setForget(false);
        }}
        onCancel={() => setForget(false)}
      />
    </SettingsSection>
  );
}
