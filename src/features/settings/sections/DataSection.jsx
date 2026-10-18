import { useEffect, useRef, useState } from 'react';
import { Database, Download, HardDrive, History, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { ConfirmDialog, Dialog } from '../../../components/common/Dialog.jsx';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import {
  BACKUP_SOURCES,
  compareBackup,
  MAX_BACKUP_BYTES,
  parseFullBackup,
  readSafetySnapshot,
  restoreFullBackup,
  serializeFullBackup,
  undoLastRestore,
} from '../../../services/backup/backupService.js';
import { isIndexedDBAvailable } from '../../../services/storage/database.js';
import { formatBytes, getStorageStatus, requestPersistentStorage } from '../../../services/storage/storageStatus.js';
import { toISODate } from '../../../utils/dates.js';
import { SettingsGroup, SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataSection() {
  const { preferences, storage, replace, reset, eraseEverything } = usePreferences();
  const { toast } = useToast();
  const notifySaved = useSavedNotice();
  const fileInput = useRef(null);

  const [status, setStatus] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [importChoice, setImportChoice] = useState({ selected: [], mode: 'merge', comparison: {} });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportChoice, setExportChoice] = useState(() => BACKUP_SOURCES.filter((source) => source.id !== 'meta').map((source) => source.id));
  const [snapshot, setSnapshot] = useState(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'reset' | 'erase'

  const refreshStatus = () => getStorageStatus().then(setStatus);
  const refreshSnapshot = () => readSafetySnapshot().then(setSnapshot);
  useEffect(() => {
    refreshStatus();
    refreshSnapshot();
  }, []);

  const askPersistence = async () => {
    const granted = await requestPersistentStorage();
    await refreshStatus();
    toast({
      id: 'persist',
      tone: granted ? 'success' : 'info',
      message: granted
        ? 'El navegador protegerá estos datos frente a limpiezas automáticas.'
        : 'El navegador no concedió la protección ahora. Suele concederla al instalar la app.',
    });
  };

  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    setBusy(true);
    try {
      // Se esperan todas las lecturas (IndexedDB incluido) antes de generar el archivo.
      const all = exportChoice.length === BACKUP_SOURCES.length - 1;
      const text = await serializeFullBackup({ preferences, include: all ? undefined : exportChoice });
      downloadText(`un-ano-mas-contigo-${all ? '' : 'parcial-'}${toISODate(new Date())}.json`, text);
      setExportOpen(false);
      notifySaved('Copia descargada');
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[backup] Exportación fallida', error);
      toast({ tone: 'error', message: 'No se pudo generar la copia. Inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };

  const readImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      toast({ tone: 'error', message: 'El archivo es demasiado grande para ser una copia de la app.' });
      return;
    }
    try {
      const plan = parseFullBackup(await file.text());
      const comparison = await compareBackup(plan);
      setImportChoice({ selected: plan.sections.filter((x) => x.id !== 'meta').map((x) => x.id), mode: 'merge', comparison });
      setPendingImport(plan);
    } catch (error) {
      toast({ tone: 'error', message: error.message });
    }
  };

  const confirmImport = async () => {
    const plan = pendingImport;
    setPendingImport(null);
    setBusy(true);
    try {
      // Antes de tocar nada se guarda una instantánea del estado actual para poder deshacer.
      await restoreFullBackup(plan, { preferences, replacePreferences: replace, selected: importChoice.selected, mode: importChoice.mode, snapshot: true });
      await refreshSnapshot();
      notifySaved('Copia restaurada', { label: 'Deshacer', onClick: () => setConfirmUndo(true) });
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[backup] Restauración fallida', error);
      toast({ tone: 'error', message: `No se restauró la copia: ${error.message} Tus datos actuales no se modificaron.` });
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => {
    const previous = preferences;
    reset();
    setConfirm(null);
    notifySaved('Configuración restablecida', { label: 'Deshacer', onClick: () => replace(previous) });
  };

  const confirmErase = async () => {
    await eraseEverything();
    // Recarga para empezar exactamente como la primera vez (incluida la presentación).
    window.location.reload();
  };

  return (
    <SettingsSection
      id="datos"
      icon={Database}
      title="Datos y almacenamiento"
      description="Todo se guarda únicamente en este navegador y en este dispositivo. No hay nube ni sincronización."
    >
      <div className="status-list">
        <p className="status-item">
          <HardDrive aria-hidden="true" className={storage.persistent ? 'is-ok' : 'is-warning'} />
          <span>
            <strong>Preferencias: </strong>
            {storage.persistent ? 'guardadas en el almacenamiento local.' : 'el navegador bloquea el almacenamiento; los cambios solo duran esta sesión.'}
          </span>
        </p>
        <p className="status-item">
          <Database aria-hidden="true" className={isIndexedDBAvailable() ? 'is-ok' : 'is-warning'} />
          <span>
            <strong>Copia de seguridad interna: </strong>
            {isIndexedDBAvailable() ? 'activa (IndexedDB).' : 'no disponible en este navegador.'}
          </span>
        </p>
        {status && (
          <p className="status-item">
            <ShieldCheck aria-hidden="true" className={status.persisted ? 'is-ok' : 'is-pending'} />
            <span>
              <strong>Protección: </strong>
              {status.persisted ? 'el navegador no borrará estos datos automáticamente.' : 'estándar (el navegador podría liberar espacio si le falta).'}
              {status.usage !== null && (
                <>
                  {' '}
                  <Badge>{formatBytes(status.usage)} usados</Badge>
                </>
              )}
            </span>
          </p>
        )}
      </div>

      {status?.supported && !status.persisted && (
        <Button variant="secondary" icon={ShieldCheck} onClick={askPersistence}>
          Proteger mis datos
        </Button>
      )}

      <p className="settings-note">
        Aun así, si se borran los datos de navegación o se desinstala la app, la información guardada se pierde. Descarga una
        copia de vez en cuando.
      </p>

      <SettingsGroup title="Copia de seguridad" description="Un archivo con tu configuración, juegos, biblioteca, finanzas, calendario, notas, diarios y adjuntos, para guardarlo o pasarlo a otro dispositivo. No está cifrado: guárdalo en un lugar privado.">
        <div className="settings-actions settings-actions--start">
          <Button variant="secondary" icon={Download} onClick={() => setExportOpen(true)} disabled={busy}>
            Descargar copia
          </Button>
          <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()} disabled={busy}>
            Restaurar copia
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={readImport} aria-hidden="true" />
          {snapshot && (
            <Button variant="ghost" icon={History} onClick={() => setConfirmUndo(true)} disabled={busy}>
              Deshacer la última restauración
            </Button>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Restablecer">
        <div className="danger-zone">
          <div>
            <p className="danger-zone__title">Restablecer la configuración</p>
            <p className="danger-zone__text">
              Vuelve a los apodos, textos, colores, estilo y fechas iniciales. No se repite la presentación ni se borran otros
              datos.
            </p>
          </div>
          <Button variant="secondary" icon={RotateCcw} onClick={() => setConfirm('reset')}>
            Restablecer
          </Button>
        </div>
        <div className="danger-zone danger-zone--critical">
          <div>
            <p className="danger-zone__title">Borrar todos los datos</p>
            <p className="danger-zone__text">
              Elimina todo lo que la app guardó en este dispositivo y la deja como recién instalada. No se puede deshacer.
            </p>
          </div>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirm('erase')}>
            Borrar todo
          </Button>
        </div>
      </SettingsGroup>

      <p className="settings-note settings-note--center">Un año más contigo · versión {__APP_VERSION__}</p>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="¿Restaurar esta copia?"
        description="Elige qué recuperar. Antes de cambiar nada se guarda el estado actual para que puedas deshacerlo."
        confirmLabel={importChoice.mode === 'replace' ? 'Reemplazar' : 'Combinar'}
        tone="primary"
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      >
        {pendingImport && (
          <>
            <ul className="backup-summary backup-choice">
              {pendingImport.sections
                .filter((section) => section.id !== 'meta')
                .map((section) => {
                  const cmp = importChoice.comparison[section.id];
                  const checked = importChoice.selected.includes(section.id);
                  return (
                    <li key={section.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setImportChoice((c) => ({ ...c, selected: checked ? c.selected.filter((x) => x !== section.id) : [...c.selected, section.id] }))
                          }
                        />
                        <span>
                          <strong>{section.label}:</strong> {section.summary ?? 'sin datos'}
                          {cmp && cmp.total > 0 && (
                            <span className="settings-note">
                              {' '}
                              {cmp.added} nuevos · {cmp.existing} ya están aquí{cmp.newer ? ` (${cmp.newer} más recientes en la copia)` : ''}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
            <fieldset className="backup-mode">
              <legend className="field__label">Cómo restaurar la organización (finanzas, calendario, notas y diarios)</legend>
              <label>
                <input type="radio" name="backup-mode" checked={importChoice.mode === 'merge'} onChange={() => setImportChoice((c) => ({ ...c, mode: 'merge' }))} />
                <span>
                  <strong>Combinar</strong> — añade lo que falta y, si algo existe en los dos lados, se queda la versión editada más tarde. No borra nada.
                </span>
              </label>
              <label>
                <input type="radio" name="backup-mode" checked={importChoice.mode === 'replace'} onChange={() => setImportChoice((c) => ({ ...c, mode: 'replace' }))} />
                <span>
                  <strong>Reemplazar</strong> — cada módulo elegido queda exactamente como en la copia (lo que no esté en ella se elimina).
                </span>
              </label>
              <p className="settings-note">La configuración, los juegos y la biblioteca siempre se reemplazan. Los adjuntos solo se añaden.</p>
            </fieldset>
          </>
        )}
        {pendingImport?.legacy && <p className="settings-note">Es una copia antigua: solo contiene la configuración. El resto de tus datos se conserva.</p>}
        {pendingImport?.issues.length > 0 && <p className="settings-note">Algunos valores del archivo no eran válidos y se usarán los predeterminados en su lugar.</p>}
      </ConfirmDialog>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="¿Qué incluir en la copia?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancelar
            </Button>
            <Button icon={Download} onClick={exportBackup} disabled={busy || !exportChoice.length}>
              {busy ? 'Preparando…' : 'Descargar'}
            </Button>
          </>
        }
      >
        <ul className="backup-summary backup-choice">
          {BACKUP_SOURCES.filter((source) => source.id !== 'meta').map((source) => {
            const checked = exportChoice.includes(source.id);
            return (
              <li key={source.id}>
                <label>
                  <input type="checkbox" checked={checked} onChange={() => setExportChoice((list) => (checked ? list.filter((x) => x !== source.id) : [...list, source.id]))} />
                  <span>{source.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="settings-note">Los diarios y los registros emocionales van en el archivo sin cifrar.</p>
      </Dialog>

      <ConfirmDialog
        open={confirmUndo}
        title="¿Deshacer la última restauración?"
        description={snapshot ? `Los datos volverán a como estaban justo antes de restaurar (${new Date(snapshot.createdAt).toLocaleString('es')}).` : ''}
        confirmLabel="Deshacer"
        tone="primary"
        onConfirm={async () => {
          try {
            await undoLastRestore({ preferences, replacePreferences: replace });
            notifySaved('Restauración deshecha');
          } catch (error) {
            toast({ tone: 'error', message: error.message });
          }
          setConfirmUndo(false);
        }}
        onCancel={() => setConfirmUndo(false)}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        title="¿Restablecer la configuración?"
        description="Se perderán tus apodos, textos, colores y fechas personalizados. Podrás deshacerlo justo después."
        confirmLabel="Restablecer"
        onConfirm={confirmReset}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'erase'}
        title="¿Borrar todos los datos?"
        description="Se eliminará todo lo guardado en este dispositivo. Esta acción no se puede deshacer."
        confirmLabel="Borrar definitivamente"
        requireText="BORRAR"
        onConfirm={confirmErase}
        onCancel={() => setConfirm(null)}
      />
    </SettingsSection>
  );
}
