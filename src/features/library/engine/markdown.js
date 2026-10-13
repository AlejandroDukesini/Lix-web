/**
 * Formato de los documentos de la biblioteca: Markdown con unas pocas extensiones.
 *
 * Este módulo es JavaScript puro (sin React ni APIs del navegador) porque lo usan
 * dos sitios: el plugin de Vite que construye el índice de la biblioteca en el
 * build (Node) y el lector en el navegador. Así los ids de las secciones, el
 * recuento de palabras y el glosario se calculan exactamente igual en ambos.
 *
 * Nunca se genera HTML como texto: el resultado es un árbol de bloques que el
 * lector convierte en elementos de React, de modo que el contenido no puede
 * inyectar marcado.
 *
 * Sintaxis admitida
 *   ---\nclave: valor\n---        cabecera de metadatos (al principio del archivo)
 *   ## Título / ### Subtítulo        secciones (los ## forman el índice)
 *   párrafos, > citas, - listas, 1. listas numeradas, | tablas |, --- (pausa de escena)
 *   **negrita**, *cursiva*, `código`, [texto](https://…)
 *   [[de|Guten Morgen]]              frase en otro idioma (es, en, de) que se puede escuchar
 *   :::tipo Título opcional … :::    recuadros: recreacion, dato, analogia, incierto, nota, gramatica
 *   :::ejercicio Pregunta … ??? … ::: ejercicio con la respuesta oculta tras ???
 */

export const CALLOUT_KINDS = Object.freeze({
  recreacion: 'Recreación literaria',
  dato: 'Lo que está documentado',
  analogia: 'Una analogía',
  incierto: 'Lo que todavía no sabemos',
  nota: 'Nota',
  gramatica: 'Gramática de bolsillo',
  ejercicio: 'Ejercicio',
});

export const SPEECH_LANGS = Object.freeze({ es: 'es-ES', en: 'en-GB', de: 'de-DE' });

/** Títulos de sección con significado especial. */
export const GLOSSARY_HEADING = 'Conceptos importantes';
export const SOURCES_HEADING = 'Fuentes y lecturas';

/** Quita tildes y pasa a minúsculas: para comparar y buscar sin depender de acentos. */
export function normalizeText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function slugify(text) {
  return (
    normalizeText(text)
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'seccion'
  );
}

// --- Metadatos -------------------------------------------------------------------

const LIST_FIELDS = new Set(['keywords', 'related']);
const NUMBER_FIELDS = new Set(['order']);

/** Separa la cabecera `---` del cuerpo. Los campos de lista van separados por comas. */
export function parseFrontmatter(source) {
  const text = String(source).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (LIST_FIELDS.has(key)) meta[key] = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
    else if (NUMBER_FIELDS.has(key)) meta[key] = Number(value);
    else meta[key] = value;
  }
  return { meta, body: text.slice(match[0].length) };
}

// --- Texto en línea -----------------------------------------------------------------

const INLINE_PATTERNS = [
  { type: 'speech', re: /\[\[(es|en|de)\|([^\]]+)\]\]/ },
  { type: 'link', re: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/ },
  { type: 'strong', re: /\*\*([^*]+(?:\*[^*]+\*[^*]*)*)\*\*/ },
  { type: 'em', re: /\*([^*\s][^*]*)\*/ },
  { type: 'code', re: /`([^`]+)`/ },
];

/**
 * Convierte una línea en una lista de nodos:
 *   'texto' | { type: 'strong'|'em', children } | { type: 'link', href, children }
 *   | { type: 'speech', lang, text } | { type: 'code', text }
 */
export function parseInline(text) {
  const nodes = [];
  let rest = String(text);
  while (rest) {
    let best = null;
    for (const pattern of INLINE_PATTERNS) {
      const match = pattern.re.exec(rest);
      if (match && (best === null || match.index < best.match.index)) best = { pattern, match };
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    const { pattern, match } = best;
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    if (pattern.type === 'speech') nodes.push({ type: 'speech', lang: match[1], text: match[2].trim() });
    else if (pattern.type === 'link') nodes.push({ type: 'link', href: match[2], children: parseInline(match[1]) });
    else if (pattern.type === 'code') nodes.push({ type: 'code', text: match[1] });
    else nodes.push({ type: pattern.type, children: parseInline(match[1]) });
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

/** Texto plano de una lista de nodos en línea (para ids, búsqueda y recuento). */
export function inlineText(nodes) {
  return nodes
    .map((node) => {
      if (typeof node === 'string') return node;
      if (node.type === 'speech' || node.type === 'code') return node.text;
      return inlineText(node.children);
    })
    .join('');
}

// --- Bloques -------------------------------------------------------------------------

const isBlank = (line) => line.trim() === '';
const HEADING = /^(#{2,4})\s+(.+?)\s*#*$/;
const LIST_ITEM = /^\s*(?:([-*])|(\d+)[.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const SCENE_BREAK = /^\s*(-{3,}|\*{3,}|⁂)\s*$/;
const FENCE_OPEN = /^:::\s*([a-z]+)\s*(.*)$/;
const FENCE_CLOSE = /^:::\s*$/;

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()));
}

/**
 * Analiza un fragmento de Markdown y devuelve sus bloques. `ids` se comparte entre
 * llamadas anidadas para que dos títulos iguales reciban ids distintos.
 */
function parseBlocks(lines, ids) {
  const blocks = [];
  let i = 0;

  const uniqueId = (text) => {
    const base = slugify(text);
    let id = base;
    for (let n = 2; ids.has(id); n += 1) id = `${base}-${n}`;
    ids.add(id);
    return id;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const inner = [];
      let depth = 1;
      i += 1;
      while (i < lines.length) {
        if (FENCE_OPEN.test(lines[i])) depth += 1;
        else if (FENCE_CLOSE.test(lines[i])) {
          depth -= 1;
          if (depth === 0) break;
        }
        inner.push(lines[i]);
        i += 1;
      }
      i += 1;
      const kind = fence[1] in CALLOUT_KINDS ? fence[1] : 'nota';
      const title = fence[2].trim();
      if (kind === 'ejercicio') {
        const split = inner.findIndex((l) => l.trim() === '???');
        const question = split === -1 ? inner : inner.slice(0, split);
        const answer = split === -1 ? [] : inner.slice(split + 1);
        blocks.push({
          type: 'exercise',
          title: parseInline(title || CALLOUT_KINDS.ejercicio),
          blocks: parseBlocks(question, ids),
          answer: parseBlocks(answer, ids),
        });
      } else {
        blocks.push({ type: 'callout', kind, title: parseInline(title || CALLOUT_KINDS[kind]), blocks: parseBlocks(inner, ids) });
      }
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const children = parseInline(heading[2]);
      blocks.push({ type: 'heading', level: heading[1].length, children, id: uniqueId(inlineText(children)) });
      i += 1;
      continue;
    }

    if (SCENE_BREAK.test(line)) {
      blocks.push({ type: 'break' });
      i += 1;
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const inner = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        inner.push(lines[i].trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(inner, ids) });
      continue;
    }

    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      const head = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = Boolean(item[2]);
      const start = ordered ? Number(item[2]) : 1;
      const items = [];
      while (i < lines.length) {
        const current = LIST_ITEM.exec(lines[i]);
        if (current && Boolean(current[2]) === ordered) {
          items.push(current[3]);
          i += 1;
        } else if (!isBlank(lines[i]) && /^\s{2,}\S/.test(lines[i]) && items.length) {
          // Continuación de un elemento largo partido en varias líneas.
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        } else break;
      }
      blocks.push({ type: 'list', ordered, start, items: items.map((text) => parseInline(text)) });
      continue;
    }

    // Párrafo: líneas seguidas hasta una línea en blanco o el inicio de otro bloque.
    const paragraph = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !FENCE_OPEN.test(lines[i]) &&
      !lines[i].trimStart().startsWith('>') &&
      !(paragraph.length && LIST_ITEM.test(lines[i])) &&
      !SCENE_BREAK.test(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
  }
  return blocks;
}

export function parseMarkdown(body) {
  return parseBlocks(String(body).replace(/\r\n?/g, '\n').split('\n'), new Set());
}

// --- Análisis del documento ------------------------------------------------------------

function blockText(block) {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlineText(block.children);
    case 'list':
      return block.items.map(inlineText).join(' ');
    case 'table':
      return [block.head, ...block.rows].map((row) => row.map(inlineText).join(' ')).join(' ');
    case 'quote':
      return block.blocks.map(blockText).join(' ');
    case 'callout':
      return [inlineText(block.title), ...block.blocks.map(blockText)].join(' ');
    case 'exercise':
      return [inlineText(block.title), ...block.blocks.map(blockText), ...block.answer.map(blockText)].join(' ');
    default:
      return '';
  }
}

export function countWords(text) {
  const words = String(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

/** Palabras por minuto de una lectura atenta en español (texto divulgativo). */
export const WORDS_PER_MINUTE = 200;

/**
 * Agrupa los bloques en secciones (cada ## abre una). La introducción, antes del
 * primer ##, tiene id `introduccion`.
 */
export function splitSections(blocks) {
  const sections = [{ id: 'introduccion', title: 'Introducción', blocks: [] }];
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2) {
      sections.push({ id: block.id, title: inlineText(block.children), heading: block, blocks: [] });
    } else {
      sections[sections.length - 1].blocks.push(block);
    }
  }
  return sections;
}

/** Entradas del glosario: elementos `**Término**: definición` de la sección de conceptos. */
function extractGlossary(section) {
  const entries = [];
  if (!section) return entries;
  for (const block of section.blocks) {
    if (block.type !== 'list') continue;
    for (const item of block.items) {
      const [first, ...rest] = item;
      if (!first || typeof first === 'string' || first.type !== 'strong') continue;
      const term = inlineText(first.children).trim();
      const definition = inlineText(rest).replace(/^\s*[:.—–-]\s*/, '').trim();
      if (term && definition) entries.push({ term, definition });
    }
  }
  return entries;
}

/**
 * Lee un documento completo y devuelve sus datos de índice (sin el texto):
 * metadatos, palabras, minutos, secciones y glosario.
 */
export function analyzeDocument(source) {
  const { meta, body } = parseFrontmatter(source);
  const blocks = parseMarkdown(body);
  const sections = splitSections(blocks);
  const sourcesSection = sections.find((s) => s.title === SOURCES_HEADING);
  const glossarySection = sections.find((s) => s.title === GLOSSARY_HEADING);

  // La lectura se mide sin la bibliografía: solo lo que se lee de verdad.
  const readable = sections.filter((s) => s !== sourcesSection);
  const words = readable.reduce(
    (sum, s) => sum + (s.heading ? countWords(blockText(s.heading)) : 0) + s.blocks.reduce((n, b) => n + countWords(blockText(b)), 0),
    0,
  );

  return {
    meta,
    words,
    minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    sections: sections.filter((s) => s.heading).map((s) => ({ id: s.id, title: s.title })),
    hasIntro: sections[0].blocks.length > 0,
    glossary: extractGlossary(glossarySection),
    sourceCount: sourcesSection
      ? sourcesSection.blocks.filter((b) => b.type === 'list').reduce((n, b) => n + b.items.length, 0)
      : 0,
    callouts: blocks.filter((b) => b.type === 'callout' || b.type === 'exercise').map((b) => (b.type === 'exercise' ? 'ejercicio' : b.kind)),
  };
}
