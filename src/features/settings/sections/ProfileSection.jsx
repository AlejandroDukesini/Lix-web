import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Heart, Plus, Trash2 } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { Button, IconButton } from '../../../components/common/Button.jsx';
import { Switch } from '../../../components/common/Switch.jsx';
import { TextField } from '../../../components/common/TextField.jsx';
import { NicknameCarousel } from '../../../components/presentation/NicknameCarousel.jsx';
import { LIMITS } from '../../../services/preferences/defaults.js';
import { normalizeText, validateNickname, validateNicknameList } from '../../../services/preferences/validation.js';
import { SettingsGroup, SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

const sameList = (a, b) => a.length === b.length && a.every((item, i) => item === b[i]);

export function ProfileSection() {
  const { preferences, update } = usePreferences();
  const saved = preferences.profile.nicknames;
  const notifySaved = useSavedNotice();

  const [draft, setDraft] = useState(saved);
  const [newNickname, setNewNickname] = useState('');
  const [addError, setAddError] = useState(null);
  const [listError, setListError] = useState(null);

  // Si las preferencias cambian desde fuera (restaurar, importar), se reinicia el borrador.
  useEffect(() => setDraft(saved), [saved]);

  const cleaned = draft.map((item) => normalizeText(item, { max: Number.MAX_SAFE_INTEGER }));
  const dirty = !sameList(cleaned, saved);
  const previewError = validateNicknameList(cleaned);

  const edit = (index, value) => {
    setListError(null);
    setDraft((list) => list.map((item, i) => (i === index ? value : item)));
  };
  const move = (index, delta) =>
    setDraft((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  const remove = (index) => setDraft((list) => list.filter((_, i) => i !== index));

  const add = (event) => {
    event.preventDefault();
    if (draft.length >= LIMITS.nicknameCount) {
      setAddError(`Puedes guardar hasta ${LIMITS.nicknameCount} apodos.`);
      return;
    }
    const { value, error } = validateNickname(newNickname, cleaned);
    if (error) {
      setAddError(error);
      return;
    }
    setDraft((list) => [...list, value]);
    setNewNickname('');
    setAddError(null);
  };

  const save = () => {
    const error = validateNicknameList(cleaned);
    if (error) {
      setListError(error);
      return;
    }
    update('profile', { nicknames: cleaned });
    setListError(null);
    notifySaved('Apodos guardados');
  };

  return (
    <SettingsSection
      id="apodos"
      icon={Heart}
      title="Cómo te llamo"
      description="Los apodos aparecen en el inicio y en la presentación, uno tras otro, en este orden."
    >
      <div className="nickname-preview" aria-live="off">
        <span className="nickname-preview__label">Vista previa</span>
        <p className="nickname-preview__stage">
          {previewError ? (
            <span className="nickname-preview__empty">Corrige la lista para ver la vista previa.</span>
          ) : (
            <NicknameCarousel key={cleaned.join('|')} nicknames={cleaned} rotate={preferences.profile.rotateNicknames} />
          )}
        </p>
      </div>

      <SettingsGroup title={`Apodos (${draft.length}/${LIMITS.nicknameCount})`}>
        <ol className="nickname-list">
          {draft.map((nickname, index) => (
            <li key={index} className="nickname-list__item">
              <span className="nickname-list__index" aria-hidden="true">
                {index + 1}
              </span>
              <TextField
                label={`Apodo ${index + 1}`}
                hideLabel
                value={nickname}
                onChange={(value) => edit(index, value)}
                maxLength={LIMITS.nicknameLength}
                className="nickname-list__field"
                autoComplete="off"
              />
              <div className="nickname-list__actions">
                <IconButton icon={ArrowUp} size="sm" label={`Subir «${nickname}»`} onClick={() => move(index, -1)} disabled={index === 0} />
                <IconButton
                  icon={ArrowDown}
                  size="sm"
                  label={`Bajar «${nickname}»`}
                  onClick={() => move(index, 1)}
                  disabled={index === draft.length - 1}
                />
                <IconButton icon={Trash2} size="sm" label={`Quitar «${nickname}»`} onClick={() => remove(index)} disabled={draft.length === 1} />
              </div>
            </li>
          ))}
        </ol>

        <form className="nickname-add" onSubmit={add} noValidate>
          <TextField
            label="Nuevo apodo"
            value={newNickname}
            onChange={(value) => {
              setNewNickname(value);
              setAddError(null);
            }}
            error={addError}
            maxLength={LIMITS.nicknameLength}
            placeholder="Por ejemplo: Mi cielo"
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" icon={Plus}>
            Añadir
          </Button>
        </form>
      </SettingsGroup>

      {listError && (
        <p className="field__error" role="alert">
          {listError}
        </p>
      )}

      <div className="settings-actions">
        <Button variant="ghost" onClick={() => setDraft(saved)} disabled={!dirty}>
          Descartar cambios
        </Button>
        <Button onClick={save} disabled={!dirty}>
          Guardar apodos
        </Button>
      </div>

      <Switch
        label="Ir cambiando de apodo"
        description="Si lo desactivas, se muestra siempre el primero de la lista."
        checked={preferences.profile.rotateNicknames}
        onChange={(rotateNicknames) => {
          update('profile', { rotateNicknames });
          notifySaved(rotateNicknames ? 'Los apodos irán cambiando' : 'Se mostrará siempre el primer apodo');
        }}
      />
    </SettingsSection>
  );
}
