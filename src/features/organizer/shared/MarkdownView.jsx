import { Fragment, useMemo } from 'react';
import { parseMarkdown } from './markdown.js';

function Inline({ nodes }) {
  return nodes.map((node, i) => {
    if (typeof node === 'string') {
      // Los saltos de línea simples dentro de un párrafo se respetan.
      const parts = node.split('\n');
      return (
        <Fragment key={i}>
          {parts.map((part, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {part}
            </Fragment>
          ))}
        </Fragment>
      );
    }
    if (node.type === 'code') return <code key={i}>{node.text}</code>;
    if (node.type === 'strong') return <strong key={i}><Inline nodes={node.children} /></strong>;
    if (node.type === 'em') return <em key={i}><Inline nodes={node.children} /></em>;
    if (node.type === 'del') return <del key={i}><Inline nodes={node.children} /></del>;
    if (node.type === 'link') {
      return (
        <a key={i} href={node.href} target="_blank" rel="noopener noreferrer">
          <Inline nodes={node.children} />
        </a>
      );
    }
    return null;
  });
}

/**
 * Vista de lectura segura (ver markdown.js). Con `onToggleTask(line)`, las casillas
 * se pueden marcar desde la propia lectura.
 */
export function MarkdownView({ source, onToggleTask, className = 'org-prose', headingOffset = 1 }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          const Tag = `h${Math.min(6, block.level + headingOffset)}`;
          return (
            <Tag key={i}>
              <Inline nodes={block.children} />
            </Tag>
          );
        }
        if (block.type === 'paragraph') return <p key={i}><Inline nodes={block.children} /></p>;
        if (block.type === 'quote') return <blockquote key={i}><Inline nodes={block.children} /></blockquote>;
        if (block.type === 'code') return <pre key={i}><code>{block.text}</code></pre>;
        if (block.type === 'rule') return <hr key={i} />;
        const List = block.ordered ? 'ol' : 'ul';
        const isTasks = block.items.some((item) => item.checked !== null);
        return (
          <List key={i} className={isTasks ? 'org-prose__tasks' : undefined}>
            {block.items.map((item) => (
              <li key={item.line} className={item.checked ? 'is-done' : undefined}>
                {item.checked !== null && (
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={!onToggleTask}
                    onChange={() => onToggleTask?.(item.line)}
                    aria-label={item.checked ? 'Marcar como pendiente' : 'Marcar como hecha'}
                  />
                )}
                <span>
                  <Inline nodes={item.children} />
                </span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
