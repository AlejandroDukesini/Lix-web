import { useId, useRef } from 'react';
import { Bold, Heading2, Italic, Link2, List, ListChecks, Quote, Strikethrough } from 'lucide-react';
import { cx } from '../../../utils/cx.js';
import { countWords } from './text.js';
import { MarkdownView } from './MarkdownView.jsx';
import { toggleTaskLine } from './markdown.js';

/**
 * Editor de texto con Markdown: área de escritura sin distracciones, barra de
 * formato y atajos (Ctrl/⌘ + B, I, K; Ctrl/⌘ + S guarda ya). Con `mode="read"`
 * muestra la vista de lectura, donde las casillas se pueden marcar.
 */
export function MarkdownEditor({ label, value, onChange, mode = 'edit', placeholder, onSaveShortcut, minRows = 14, autoFocus }) {
  const id = useId();
  const ref = useRef(null);

  const wrap = (before, after = before, fallback = 'texto') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefixLines = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const endIndex = value.indexOf('\n', el.selectionEnd);
    const end = endIndex === -1 ? value.length : endIndex;
    const block = value
      .slice(start, end)
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`))
      .join('\n');
    onChange(`${value.slice(0, start)}${block}${value.slice(end)}`);
    requestAnimationFrame(() => el.focus());
  };

  const tools = [
    { label: 'Negrita (Ctrl+B)', icon: Bold, run: () => wrap('**') },
    { label: 'Cursiva (Ctrl+I)', icon: Italic, run: () => wrap('*') },
    { label: 'Tachado', icon: Strikethrough, run: () => wrap('~~') },
    { label: 'Encabezado', icon: Heading2, run: () => prefixLines('## ') },
    { label: 'Lista', icon: List, run: () => prefixLines('- ') },
    { label: 'Lista de casillas', icon: ListChecks, run: () => prefixLines('- [ ] ') },
    { label: 'Cita', icon: Quote, run: () => prefixLines('> ') },
    { label: 'Enlace (Ctrl+K)', icon: Link2, run: () => wrap('[', '](https://)', 'enlace') },
  ];

  const onKeyDown = (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) {
      // Enter en una lista continúa la lista; en un elemento vacío, la termina.
      if (event.key === 'Enter' && !event.shiftKey) {
        const el = event.currentTarget;
        const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
        const line = value.slice(lineStart, el.selectionStart);
        const match = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/.exec(line);
        if (match && el.selectionStart === el.selectionEnd) {
          event.preventDefault();
          if (line.trim() === match[0].trim()) {
            onChange(`${value.slice(0, lineStart)}${value.slice(el.selectionStart)}`);
            requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
            return;
          }
          const bullet = /^\d+/.test(match[2]) ? `${Number.parseInt(match[2], 10) + 1}${match[2].slice(-1)}` : match[2];
          const insert = `\n${match[1]}${bullet} ${match[3] ? '[ ] ' : ''}`;
          const pos = el.selectionStart;
          onChange(`${value.slice(0, pos)}${insert}${value.slice(pos)}`);
          requestAnimationFrame(() => el.setSelectionRange(pos + insert.length, pos + insert.length));
        }
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'b') wrap('**');
    else if (key === 'i') wrap('*');
    else if (key === 'k') wrap('[', '](https://)', 'enlace');
    else if (key === 's') onSaveShortcut?.();
    else return;
    event.preventDefault();
  };

  const words = countWords(value);
  return (
    <div className="org-editor">
      {mode === 'edit' ? (
        <>
          <div className="org-editor__toolbar" role="toolbar" aria-label="Formato" aria-controls={id}>
            {tools.map((tool) => (
              <button key={tool.label} type="button" className="org-editor__tool" onClick={tool.run} aria-label={tool.label} title={tool.label}>
                <tool.icon aria-hidden="true" />
              </button>
            ))}
          </div>
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
          <textarea
            id={id}
            ref={ref}
            className="org-editor__area"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={minRows}
            spellCheck
            autoFocus={autoFocus}
          />
        </>
      ) : (
        <div className={cx('org-editor__read', !value.trim() && 'is-empty')}>
          {value.trim() ? <MarkdownView source={value} onToggleTask={(line) => onChange(toggleTaskLine(value, line))} /> : <p className="org-muted">Todavía no hay texto.</p>}
        </div>
      )}
      <p className="org-editor__count" aria-live="off">
        {words.toLocaleString('es')} {words === 1 ? 'palabra' : 'palabras'} · {value.length.toLocaleString('es')} {value.length === 1 ? 'carácter' : 'caracteres'}
      </p>
    </div>
  );
}
