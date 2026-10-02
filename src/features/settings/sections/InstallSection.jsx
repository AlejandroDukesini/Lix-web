import { CircleCheck, Download, MonitorSmartphone, Share, SquarePlus, WifiOff } from 'lucide-react';
import { usePwa } from '../../../hooks/usePwa.js';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { SettingsGroup, SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

function IosSteps() {
  return (
    <ol className="steps">
      <li>
        Abre esta app en <strong>Safari</strong>.
      </li>
      <li>
        Toca <Share className="inline-icon" aria-label="Compartir" /> <strong>Compartir</strong> en la barra inferior.
      </li>
      <li>
        Elige <SquarePlus className="inline-icon" aria-hidden="true" /> <strong>Añadir a pantalla de inicio</strong> y confirma con{' '}
        <strong>Añadir</strong>.
      </li>
    </ol>
  );
}

function ManualSteps({ platform }) {
  if (platform === 'android') {
    return (
      <ol className="steps">
        <li>
          Abre el menú <strong>⋮</strong> del navegador.
        </li>
        <li>
          Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
        </li>
      </ol>
    );
  }
  return (
    <ol className="steps">
      <li>
        En <strong>Chrome</strong> o <strong>Edge</strong>, busca el icono de instalar al final de la barra de direcciones.
      </li>
      <li>
        O abre el menú del navegador y elige <strong>Instalar «Un año más contigo»</strong>.
      </li>
      <li>Firefox de escritorio no permite instalar apps web; puedes usarla igualmente en una pestaña.</li>
    </ol>
  );
}

export function InstallSection() {
  const { installStatus, platform, promptInstall, offlineReady, supported } = usePwa();
  const notifySaved = useSavedNotice();

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') notifySaved('Instalada. Ya puedes abrirla como una app.');
  };

  return (
    <SettingsSection
      id="instalacion"
      icon={MonitorSmartphone}
      title="Instalar y usar sin Internet"
      description="Instálala para abrirla como una app independiente, en el computador o en el teléfono."
    >
      <div className="status-list">
        <p className="status-item">
          <CircleCheck aria-hidden="true" className={installStatus === 'installed' ? 'is-ok' : 'is-pending'} />
          <span>
            <strong>Instalación: </strong>
            {installStatus === 'installed' ? 'abierta como app instalada.' : 'se está usando en el navegador.'}
          </span>
        </p>
        <p className="status-item">
          <WifiOff aria-hidden="true" className={offlineReady ? 'is-ok' : 'is-pending'} />
          <span>
            <strong>Sin conexión: </strong>
            {offlineReady
              ? 'todos los archivos están guardados en este dispositivo.'
              : supported && import.meta.env.PROD
                ? 'preparando la copia local… se completa tras la primera carga.'
                : 'disponible en la versión de producción (npm run start), no en modo desarrollo.'}
          </span>
        </p>
      </div>

      {installStatus === 'available' && (
        <Button icon={Download} onClick={install}>
          Instalar aplicación
        </Button>
      )}

      {installStatus === 'ios' && (
        <SettingsGroup title="En iPhone o iPad" description="iOS no muestra un botón de instalación automático; se instala así:">
          <IosSteps />
        </SettingsGroup>
      )}

      {installStatus === 'manual' && (
        <SettingsGroup
          title={
            <>
              Instalar manualmente <Badge>{platform === 'android' ? 'Android' : 'Computador'}</Badge>
            </>
          }
          description="Este navegador no ofreció instalación automática todavía. Puedes hacerlo desde su menú:"
        >
          <ManualSteps platform={platform} />
        </SettingsGroup>
      )}
    </SettingsSection>
  );
}
