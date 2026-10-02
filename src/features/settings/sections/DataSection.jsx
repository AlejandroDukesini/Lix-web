import { useEffect, useRef, useState } from 'react';
import { Database, Download, HardDrive, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { ConfirmDialog } from '../../../components/common/Dialog.jsx';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import { parseBackup, serializeBackup } from '../../../services/preferences/preferencesService.js';
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
  const [confirm, setConfirm] = useState(null); // 'reset' | 'erase'

  const refreshStatus = () => getStorageStatus().then(setStatus);
  useEffect(() => {
    refreshStatus();
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

  const exportBackup = () => {
    downloadText(`un-ano-mas-contigo-${toISODate(new Date())}.json`, serializeBackup(preferences));
    notifySaved('Copia descargada');
  };

  const readImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast({ tone: 'error', message: 'El archivo es demasiado grande para ser una copia de la app.' });
      return;
    }
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch (error) {
      toast({ tone: 'error', message: error.message });
    }
  };

  const confirmImport = () => {
    replace(pendingImport.preferences);
    setPendingImport(null);
    notifySaved('Copia restaurada');
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

      <SettingsGroup title="Copia de seguridad" description="Un archivo con tus preferencias para guardarlo o pasarlo a otro dispositivo.">
        <div className="settings-actions settings-actions--start">
          <Button variant="secondary" icon={Download} onClick={exportBackup}>
            Descargar copia
          </Button>
          <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()}>
            Restaurar copia
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={readImport} aria-hidden="true" />
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

      <p className="settings-note settings-note--center">Un año más contigo · versión {__APP_VERSION__} · Fase 1</p>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="¿Restaurar esta copia?"
        description="Reemplazará la configuración actual por la del archivo."
        confirmLabel="Restaurar"
        tone="primary"
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      >
        {pendingImport?.issues.length > 0 && (
          <p className="settings-note">Algunos valores del archivo no eran válidos y se usarán los predeterminados en su lugar.</p>
        )}
      </ConfirmDialog>

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
