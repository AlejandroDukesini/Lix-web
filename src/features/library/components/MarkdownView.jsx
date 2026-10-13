import { Fragment } from 'react';
import { BookOpenText, Feather, FlaskConical, Lightbulb, CircleHelp, PenLine, Volume2 } from 'lucide-react';
import { SPEECH_LANGS } from '../engine/markdown.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { cx } from '../../../utils/cx.js';

const LANG_NAMES = { es: 'español', en: 'inglés', de: 'alemán' };
const CALLOUT_ICONS = {
  recreacion: Feather,
  dato: FlaskConical,
  analogia: Lightbulb,
  incierto: CircleHelp,
  nota: BookOpenText,
  gramatica: PenLine,
};

/** Frase en otro idioma: se marca con su `lang` (lectores de pantalla, separación silábica) y se puede escuchar. */
function Phrase({ lang, text }) {
  const { available, speaking, speak } = useSpeech(lang);
  return (
    <span className="md-phrase" lang={SPEECH_LANGS[lang]}>
      <span className="md-phrase__text">{text}</span>
      {available && (
        <button
          type="button"
          className={cx('md-phrase__play', speaking && 'is-speaking')}
          onClick={() => speak(text)}
          aria-label={`Escuchar en ${LANG_NAMES[lang]}: ${text}`}
          title={`Escuchar (${LANG_NAMES[lang]})`}
        >
          <Volume2 aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export function Inline({ nodes }) {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return <Fragment key={i}>{node}</Fragment>;
    switch (node.type) {
      case 'strong':
        return (
          <strong key={i}>
            <Inline nodes={node.children} />
          </strong>
        );
      case 'em':
        return (
          <em key={i}>
            <Inline nodes={node.children} />
          </em>
        );
      case 'code':
        return <code key={i}>{node.text}</code>;
      case 'link':
        return (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className="md-link">
            <Inline nodes={node.children} />
            <span className="sr-only"> (enlace externo, requiere conexión)</span>
          </a>
        );
      case 'speech':
        return <Phrase key={i} lang={node.lang} text={node.text} />;
      default:
        return null;
    }
  });
}

/**
 * Convierte los bloques del documento en elementos. `renderHeading(block)` permite
 * al lector añadir su botón de marcador a cada sección.
 */
export function Blocks({ blocks, renderHeading }) {
  return blocks.map((block, i) => <Block key={block.id ?? i} block={block} renderHeading={renderHeading} />);
}

function Block({ block, renderHeading }) {
  switch (block.type) {
    case 'heading': {
      if (renderHeading) return renderHeading(block);
      const Tag = `h${block.level}`;
      return (
        <Tag id={block.id} className={`md-h md-h--${block.level}`}>
          <Inline nodes={block.children} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="md-p">
          <Inline nodes={block.children} />
        </p>
      );
    case 'quote':
      return (
        <blockquote className="md-quote">
          <Blocks blocks={block.blocks} />
        </blockquote>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="md-list" start={block.ordered && block.start !== 1 ? block.start : undefined}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline nodes={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        // La tabla se desplaza dentro de su marco: nunca ensancha la página en móvil.
        <div className="md-table" role="region" aria-label="Tabla" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col">
                    <Inline nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <Inline nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'break':
      return (
        <p className="md-break" role="separator">
          <span aria-hidden="true">⁂</span>
        </p>
      );
    case 'callout': {
      const Icon = CALLOUT_ICONS[block.kind] ?? BookOpenText;
      return (
        <aside className={cx('md-callout', `md-callout--${block.kind}`)}>
          <p className="md-callout__title">
            <Icon aria-hidden="true" />
            <Inline nodes={block.title} />
          </p>
          <Blocks blocks={block.blocks} />
        </aside>
      );
    }
    case 'exercise':
      return (
        <section className="md-callout md-callout--ejercicio">
          <p className="md-callout__title">
            <PenLine aria-hidden="true" />
            <Inline nodes={block.title} />
          </p>
          <Blocks blocks={block.blocks} />
          {block.answer.length > 0 && (
            <details className="md-answer">
              <summary>Ver la respuesta</summary>
              <Blocks blocks={block.answer} />
            </details>
          )}
        </section>
      );
    default:
      return null;
  }
}
