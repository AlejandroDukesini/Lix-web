import { useEffect, useId, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import { ATTACHMENT_TYPES, readAttachment, saveAttachment } from '../data/attachments.js';

/** Vista previa de un adjunto: miniatura para imágenes, enlace para PDF. */
export function AttachmentPreview({ id, onRemove }) {
  const [item, setItem] = useState(null);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    let objectUrl = null;
    readAttachment(id).then((record) => {
      if (!active || !record) return;
      objectUrl = URL.createObjectURL(new Blob([record.data], { type: record.type }));
      setItem(record);
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!item) return <li className="org-attachment is-missing">Archivo no disponible</li>;
  return (
    <li className="org-attachment">
      <a href={url} target="_blank" rel="noopener noreferrer" className="org-attachment__link" title={item.name}>
        {item.type.startsWith('image/') ? <img src={url} alt={item.name} /> : <FileText aria-hidden="true" />}
        <span className="org-attachment__name">{item.name}</span>
      </a>
      {onRemove && (
        <button type="button" className="org-attachment__remove" onClick={onRemove} aria-label={`Quitar ${item.name}`}>
          <X aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/** Campo para adjuntar archivos. `value` = lista de ids. */
export function AttachmentsField({ label = 'Adjuntos', value, onChange, max = 5, hint = 'Imágenes o PDF de hasta 3 MB. Se guardan solo en este dispositivo.' }) {
  const id = useId();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const add = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const added = [];
    for (const file of files.slice(0, max - value.length)) {
      try {
        added.push((await saveAttachment(file)).id);
      } catch (error) {
        toast({ tone: 'error', message: error.message });
      }
    }
    setBusy(false);
    if (added.length) onChange([...value, ...added]);
  };
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {value.length > 0 && (
        <ul className="org-attachments">
          {value.map((attachmentId) => (
            <AttachmentPreview key={attachmentId} id={attachmentId} onRemove={() => onChange(value.filter((x) => x !== attachmentId))} />
          ))}
        </ul>
      )}
      {value.length < max && (
        <label htmlFor={id} className="btn btn--secondary btn--sm org-attach-btn">
          <Paperclip className="btn__icon" aria-hidden="true" />
          <span className="btn__label">{busy ? 'Guardando…' : 'Adjuntar archivo'}</span>
          <input id={id} type="file" accept={ATTACHMENT_TYPES.join(',')} multiple className="sr-only" onChange={add} disabled={busy} />
        </label>
      )}
      <p className="field__hint">{hint}</p>
    </div>
  );
}
