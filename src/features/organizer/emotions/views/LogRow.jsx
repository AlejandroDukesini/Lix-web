import { useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { deleteRecord, duplicateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { ActionMenu, DeleteDialog } from '../../shared/ui.jsx';
import { dateTimeLabel } from '../../shared/format.js';
import { excerpt } from '../../shared/text.js';
import { MOODS } from '../content.js';
import { intensityPercent } from '../emotionStats.js';
import { LogForm } from '../LogForm.jsx';
import { useEmotions } from '../useEmotions.js';

export function LogRow({ log }) {
  const data = useEmotions();
  const run = useRunner();
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  const emotion = data.emotionsById.get(log.primaryId);
  const secondary = log.secondaryIds.map((id) => data.emotionsById.get(id)?.name).filter(Boolean);
  const mood = MOODS.find((m) => m.value === log.mood);
  return (
    <li className="org-row org-log" style={{ '--item-color': emotion?.color ?? 'var(--c-secondary)' }}>
      <span className="org-log__intensity" aria-hidden="true">
        <span style={{ blockSize: `${Math.max(8, intensityPercent(log))}%` }} />
      </span>
      <button type="button" className="org-row__main" onClick={() => setEdit(true)}>
        <span className="org-row__title">
          {emotion?.name ?? 'Emoción eliminada'}
          {secondary.length > 0 && <span className="org-subtle"> · con {secondary.join(', ').toLowerCase()}</span>}
        </span>
        <span className="org-row__meta">
          <span>{dateTimeLabel(log.at)}</span>
          <span>
            Intensidad {log.intensity}/{log.scale}
          </span>
          {mood && <span>Ánimo: {mood.label.toLowerCase()}</span>}
          {log.contextTags.length > 0 && <span>{log.contextTags.join(', ')}</span>}
        </span>
        {(log.description || log.context) && <span className="org-log__text">{excerpt(log.description || log.context, 160)}</span>}
      </button>
      <ActionMenu
        label={`Acciones del registro de ${emotion?.name ?? 'emoción'}`}
        items={[
          { label: 'Ver y editar', icon: Pencil, onClick: () => setEdit(true) },
          { label: 'Duplicar con fecha de ahora', icon: Copy, onClick: () => run(() => duplicateRecord(log.id, { at: new Date().toISOString() }), { success: 'Registro duplicado' }) },
          { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(true) },
        ]}
      />
      {edit && <LogForm initial={log} open onClose={() => setEdit(false)} />}
      <DeleteDialog
        open={remove}
        recordId={log.id}
        title="¿Eliminar este registro?"
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(log.id), { success: 'Registro eliminado' });
          if (ok) setRemove(false);
        }}
      />
    </li>
  );
}
