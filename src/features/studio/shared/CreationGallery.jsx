import { useEffect, useMemo, useState } from 'react';
import { Download, Heart, Trash2 } from 'lucide-react';
import { IconButton } from '../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../components/common/Dialog.jsx';
import { cx } from '../../../utils/cx.js';
import { readAttachment } from '../../organizer/data/attachments.js';
import { deleteRecord, updateRecord } from '../../organizer/data/store.js';
import { useKind, useRunner } from '../../organizer/data/hooks.js';
import { EmptyState } from '../../organizer/shared/ui.jsx';
import { downloadBlob, slugify } from './creations.js';

const ORIGIN_LABELS = { flowers: 'Python · Lix Flowers', procedural: 'Procedural (no es IA)', ai: 'IA' };

function useAttachmentBlob(id) {
  const [state, setState] = useState({ blob: null, url: null, missing: false });
  useEffect(() => {
    let active = true;
    let url = null;
    readAttachment(id).then((record) => {
      if (!active) return;
      if (!record) {
        setState({ blob: null, url: null, missing: true });
        return;
      }
      const blob = new Blob([record.data], { type: record.type });
      url = URL.createObjectURL(blob);
      setState({ blob, url, missing: false });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return state;
}

function CreationCard({ creation, onDelete }) {
  const run = useRunner();
  const { blob, url, missing } = useAttachmentBlob(creation.attachmentIds[0]);
  const date = new Date(creation.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  const originLabel = creation.origin === 'ai' && creation.provider ? `IA · ${creation.provider}` : ORIGIN_LABELS[creation.origin];
  return (
    <li className="creation-card">
      <div className="creation-card__media">
        {url ? <img src={url} alt={creation.prompt || creation.title} loading="lazy" /> : <span className="org-subtle">{missing ? 'Archivo no disponible' : 'Cargando…'}</span>}
      </div>
      <div className="creation-card__body">
        <p className="creation-card__title">{creation.title}</p>
        <p className="creation-card__meta">
          <span className={cx('creation-card__origin', `is-${creation.origin}`)}>{originLabel}</span> · {date}
        </p>
        {creation.prompt && <p className="creation-card__prompt">«{creation.prompt}»</p>}
      </div>
      <div className="creation-card__actions">
        <IconButton
          icon={Heart}
          label={creation.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
          className={creation.favorite ? 'is-favorite' : undefined}
          aria-pressed={creation.favorite}
          onClick={() => run(() => updateRecord(creation.id, { favorite: !creation.favorite }))}
        />
        <IconButton icon={Download} label="Descargar" disabled={!blob} onClick={() => blob && downloadBlob(blob, `${slugify(creation.title)}.${blob.type.split('/')[1] ?? 'bin'}`)} />
        <IconButton icon={Trash2} label="Eliminar" onClick={() => onDelete(creation)} />
      </div>
    </li>
  );
}

/** Galería de creaciones guardadas de uno o varios orígenes. Las favoritas van primero. */
export function CreationGallery({ origins, emptyTitle, emptyText, icon }) {
  const all = useKind('creation');
  const run = useRunner();
  const [removing, setRemoving] = useState(null);
  const items = useMemo(
    () =>
      all
        .filter((c) => origins.includes(c.origin))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt)),
    [all, origins],
  );
  if (!items.length) return <EmptyState icon={icon} title={emptyTitle}>{emptyText}</EmptyState>;
  return (
    <>
      <ul className="creation-grid">
        {items.map((creation) => (
          <CreationCard key={creation.id} creation={creation} onDelete={setRemoving} />
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(removing)}
        title="¿Eliminar esta creación?"
        description={removing ? `«${removing.title}» y su archivo se borrarán de este dispositivo. No se puede deshacer (salvo desde una copia de seguridad).` : ''}
        confirmLabel="Eliminar"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          await run(() => deleteRecord(removing.id), { success: 'Creación eliminada' });
          setRemoving(null);
        }}
      />
    </>
  );
}
