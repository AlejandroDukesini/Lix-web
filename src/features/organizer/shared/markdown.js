/**
 * Markdown de notas y diario: parser puro que devuelve un árbol de bloques.
 *
 * Seguridad: el texto NUNCA se interpreta como HTML. React pinta cada nodo como
 * texto o como un elemento conocido; `<script>` se ve tal cual. Los enlaces solo
 * pueden ser http(s) o mailto: `javascript:` y similares se quedan como texto.
 *
 * Sintaxis: # ## ### títulos · - * listas · 1. listas numeradas · - [ ] / - [x] casillas
 *           > citas · ``` código ``` · --- separador · **negrita** · *cursiva* · ~~tachado~~
 *           `código` · [texto](https://…) · enlaces sueltos https://…
 */

const SAFE_URL = /^(https?:\/\/|mailto:)[^\s]+$/i;

export function isSafeUrl(url) {
  return typeof url === 'string' && SAFE_URL.test(url.trim());
}

const INLINE = /(`([^`\n]+)`)|(\*\*([^*\n]+?)\*\*)|(~~([^~\n]+?)~~)|(\*([^*\n]+?)\*)|(_([^_\n]+?)_)|(\[([^\]\n]+)\]\(([^)\s]+)\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;

/** Texto → nodos en línea: string | { type: code|strong|em|del|link, ... }. */
export function parseInline(text) {
  const nodes = [];
  let last = 0;
  // Una expresión por llamada: parseInline es recursiva y un `lastIndex` compartido entraría en bucle.
  const pattern = new RegExp(INLINE.source, 'g');
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) nodes.push({ type: 'code', text: match[2] });
    else if (match[3]) nodes.push({ type: 'strong', children: parseInline(match[4]) });
    else if (match[5]) nodes.push({ type: 'del', children: parseInline(match[6]) });
    else if (match[7]) nodes.push({ type: 'em', children: parseInline(match[8]) });
    else if (match[9]) nodes.push({ type: 'em', children: parseInline(match[10]) });
    else if (match[11]) {
      const href = match[13];
      nodes.push(isSafeUrl(href) ? { type: 'link', href, children: parseInline(match[12]) } : match[0]);
    } else if (match[14]) nodes.push({ type: 'link', href: match[14], children: [match[14]] });
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Texto → bloques: heading, paragraph, list (items con `checked` y `line`), quote, code, rule.
 * `line` es el índice de la línea en el texto original (para marcar casillas desde la vista).
 */
export function parseMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', children: parseInline(body.join('\n')) });
      continue;
    }
    const listItem = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
    if (listItem.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && listItem.test(lines[i]) && /^\s*\d/.test(lines[i]) === ordered) {
        const [, , rest] = listItem.exec(lines[i]);
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(rest);
        items.push({ line: i, checked: task ? task[1] !== ' ' : null, children: parseInline(task ? task[2] : rest) });
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const body = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|```|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) && !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])) {
      body.push(lines[i++]);
    }
    blocks.push({ type: 'paragraph', children: parseInline(body.join('\n')) });
  }
  return blocks;
}

/** Marca o desmarca la casilla de la línea `line` y devuelve el texto nuevo. */
export function toggleTaskLine(source, line) {
  const lines = String(source ?? '').split('\n');
  if (!lines[line]) return source;
  lines[line] = lines[line].replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/, (_, prefix, mark) => `${prefix}[${mark === ' ' ? 'x' : ' '}]`);
  return lines.join('\n');
}

/** Progreso de las casillas de un texto: { done, total }. */
export function taskProgress(source) {
  let done = 0;
  let total = 0;
  for (const match of String(source ?? '').matchAll(/^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]/gm)) {
    total += 1;
    if (match[1] !== ' ') done += 1;
  }
  return { done, total };
}
