/**
 * Guardado automático de un editor (notas y diario).
 *
 *  - Agrupa: guarda 800 ms después de la última pulsación (no en cada tecla).
 *  - Nunca pisa lo más reciente: el borrador local es la fuente de verdad mientras se
 *    edita. Si al terminar un guardado hubo más cambios, se encadena otro.
 *  - Recuperación: cada cambio se copia al momento en localStorage (`uamc:draft:<id>`).
 *    Si la app se cierra antes de guardar, al volver a abrir el registro se ofrece
 *    recuperar ese borrador. Se borra en cuanto el guardado termina.
 *  - Al salir de la pantalla, ocultar la pestaña o cerrar la app se fuerza el guardado.
 *  - Cambios desde otra pestaña: si aquí no hay nada pendiente se adoptan; si lo hay,
 *    se avisa (`conflict`) y el siguiente guardado conserva lo que se ve en pantalla.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readJSON, removeKey, writeJSON } from '../../../services/storage/safeLocalStorage.js';

const DELAY = 800;
const draftKey = (id) => `uamc:draft:${id}`;

const pick = (record, fields) => Object.fromEntries(fields.map((f) => [f, record?.[f]]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function readDraft(id) {
  const { value } = readJSON(draftKey(id));
  return value && typeof value === 'object' && value.fields ? value : null;
}

export function clearDraft(id) {
  removeKey(draftKey(id));
}

export function useAutosave({ record, fields, save }) {
  const id = record?.id;
  const [values, setValues] = useState(() => pick(record, fields));
  const [state, setState] = useState('saved'); // saved | dirty | saving | error
  const [savedAt, setSavedAt] = useState(record?.updatedAt ?? null);
  const [conflict, setConflict] = useState(false);
  const [recoverable, setRecoverable] = useState(null);

  const valuesRef = useRef(values);
  const versionRef = useRef(0); // sube con cada cambio local
  const savedVersionRef = useRef(0);
  const savingRef = useRef(false);
  const timerRef = useRef(null);
  const lastRevRef = useRef(record?.rev ?? 0);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Al abrir otro registro: valores nuevos y, si hay un borrador más reciente sin guardar, se ofrece.
  useEffect(() => {
    if (!id) return;
    const initial = pick(record, fields);
    valuesRef.current = initial;
    setValues(initial);
    versionRef.current = 0;
    savedVersionRef.current = 0;
    lastRevRef.current = record.rev;
    setState('saved');
    setSavedAt(record.updatedAt);
    setConflict(false);
    const draft = readDraft(id);
    if (draft && !same(pick(draft.fields, fields), initial) && draft.at > record.updatedAt) setRecoverable(draft);
    else {
      setRecoverable(null);
      if (draft) clearDraft(id);
    }
    // Solo al cambiar de registro: las actualizaciones del mismo registro se tratan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (!id || savingRef.current || versionRef.current === savedVersionRef.current) return;
    savingRef.current = true;
    const version = versionRef.current;
    const snapshot = valuesRef.current;
    setState('saving');
    try {
      const saved = await saveRef.current(snapshot);
      if (saved?.rev) lastRevRef.current = saved.rev;
      savedVersionRef.current = version;
      setSavedAt(saved?.updatedAt ?? new Date().toISOString());
      setConflict(false);
      if (versionRef.current === version) {
        clearDraft(id);
        setState('saved');
      } else setState('dirty');
    } catch {
      setState('error');
    } finally {
      savingRef.current = false;
    }
    // Si se escribió durante el guardado, se guarda otra vez.
    if (versionRef.current !== savedVersionRef.current) timerRef.current = setTimeout(() => flush(), DELAY);
  }, [id]);

  const update = useCallback(
    (patch) => {
      const next = { ...valuesRef.current, ...(typeof patch === 'function' ? patch(valuesRef.current) : patch) };
      valuesRef.current = next;
      versionRef.current += 1;
      setValues(next);
      setState('dirty');
      if (id) writeJSON(draftKey(id), { fields: next, at: new Date().toISOString() });
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => flush(), DELAY);
    },
    [id, flush],
  );

  // Cambios del mismo registro hechos fuera de este editor (otra pestaña, una casilla marcada…).
  useEffect(() => {
    // Mientras hay un guardado propio en curso, la nueva versión es la nuestra.
    if (!record || record.id !== id || record.rev <= lastRevRef.current || savingRef.current) return;
    lastRevRef.current = record.rev;
    const external = pick(record, fields);
    if (same(external, valuesRef.current)) return;
    if (versionRef.current === savedVersionRef.current && !savingRef.current) {
      valuesRef.current = external;
      setValues(external);
      setSavedAt(record.updatedAt);
    } else setConflict(true);
  }, [record, id, fields]);

  // Guardar al ocultar la pestaña, al cerrar y al desmontar.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onUnload = (event) => {
      if (versionRef.current !== savedVersionRef.current) {
        flush();
        event.preventDefault();
        event.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      flush();
    };
  }, [flush]);

  const recover = useCallback(() => {
    if (!recoverable) return;
    update(pick(recoverable.fields, fields));
    setRecoverable(null);
  }, [recoverable, update, fields]);

  const discardRecovery = useCallback(() => {
    if (id) clearDraft(id);
    setRecoverable(null);
  }, [id]);

  const keepMine = useCallback(() => {
    setConflict(false);
    versionRef.current += 1;
    flush();
  }, [flush]);

  const takeTheirs = useCallback(() => {
    const external = pick(record, fields);
    valuesRef.current = external;
    savedVersionRef.current = versionRef.current;
    setValues(external);
    setConflict(false);
    setState('saved');
    if (id) clearDraft(id);
  }, [record, fields, id]);

  return { values, update, state, savedAt, flush, conflict, keepMine, takeTheirs, recoverable, recover, discardRecovery };
}
