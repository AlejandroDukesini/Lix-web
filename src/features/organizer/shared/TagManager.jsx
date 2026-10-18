import { useMemo, useState } from 'react';
import { Pencil, Tag, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../../components/common/Dialog.jsx';
import { useKind, useRunner } from '../data/hooks.js';
import { removeTag, renameTag, tagCounts } from '../data/tags.js';
import { InputField } from './Fields.jsx';
import { ActionMenu, FormDialog } from './ui.jsx';

/**
 * Gestión de etiquetas de un módulo: ver cuántas veces se usa cada una, renombrarla
 * (si el nombre nuevo ya existe, se fusionan) o quitarla de todos los registros.
 * Quitar una etiqueta nunca borra los registros que la tenían.
 */
export function TagManager({ kinds, noun = 'registros' }) {
  const a = useKind(kinds[0]);
  const b = useKind(kinds[1] ?? kinds[0]);
  const run = useRunner();
  const tags = useMemo(() => tagCounts(kinds.length > 1 ? [...a, ...b] : a), [a, b, kinds.length]);
  const [rename, setRename] = useState(null);
  const [value, setValue] = useState('');
  const [remove, setRemove] = useState(null);
  if (!tags.length) return <p className="org-muted">Todavía no hay etiquetas: se crean al escribirlas mientras editas.</p>;
  return (
    <>
      <ul className="org-tagcloud">
        {tags.map(({ tag, count }) => (
          <li key={tag} className="org-tagcloud__item">
            <Tag aria-hidden="true" width={14} height={14} />
            <span>{tag}</span>
            <span className="org-count">{count}</span>
            <ActionMenu
              label={`Acciones de la etiqueta ${tag}`}
              items={[
                {
                  label: 'Renombrar o fusionar',
                  icon: Pencil,
                  onClick: () => {
                    setValue(tag);
                    setRename(tag);
                  },
                },
                { label: 'Quitar de todos', icon: Trash2, danger: true, onClick: () => setRemove({ tag, count }) },
              ]}
            />
          </li>
        ))}
      </ul>
      <FormDialog
        open={Boolean(rename)}
        title={`Renombrar «${rename ?? ''}»`}
        description="Si escribes el nombre de otra etiqueta existente, las dos se fusionan."
        size="sm"
        onClose={() => setRename(null)}
        onSubmit={async () => {
          if (!value.trim() || value.trim() === rename) return true;
          return (await run(() => renameTag(kinds, rename, value), { success: 'Etiqueta actualizada' })).ok;
        }}
      >
        <InputField label="Nuevo nombre" value={value} onChange={setValue} maxLength={30} autoFocus />
      </FormDialog>
      <ConfirmDialog
        open={Boolean(remove)}
        title={`¿Quitar la etiqueta «${remove?.tag ?? ''}»?`}
        description={`Se quitará de ${remove?.count ?? 0} ${noun}. Los ${noun} se conservan.`}
        confirmLabel="Quitar"
        onConfirm={async () => {
          await run(() => removeTag(kinds, remove.tag), { success: 'Etiqueta quitada' });
          setRemove(null);
        }}
        onCancel={() => setRemove(null)}
      />
    </>
  );
}
