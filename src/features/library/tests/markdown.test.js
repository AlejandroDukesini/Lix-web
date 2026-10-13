import { describe, expect, it } from 'vitest';
import { analyzeDocument, countWords, inlineText, parseFrontmatter, parseInline, parseMarkdown, slugify } from '../engine/markdown.js';

describe('formato de los documentos', () => {
  it('lee la cabecera con listas y números', () => {
    const { meta, body } = parseFrontmatter('---\nid: prueba\norder: 3\nkeywords: a, b ,c\n---\nTexto');
    expect(meta).toEqual({ id: 'prueba', order: 3, keywords: ['a', 'b', 'c'] });
    expect(body).toBe('Texto');
  });

  it('genera ids sin tildes ni signos y únicos', () => {
    expect(slugify('¿Qué sucede cerca de un agujero negro?')).toBe('que-sucede-cerca-de-un-agujero-negro');
    expect(slugify('Straße')).toBe('strasse');
    const blocks = parseMarkdown('## Fuentes\n\n## Fuentes');
    expect(blocks.map((b) => b.id)).toEqual(['fuentes', 'fuentes-2']);
  });

  it('analiza texto en línea anidado, enlaces y frases para escuchar', () => {
    const nodes = parseInline('Di **hola *ya*** y [[de|Guten Morgen]] o lee [esto](https://example.org).');
    expect(nodes[1]).toMatchObject({ type: 'strong' });
    expect(nodes[1].children[1]).toMatchObject({ type: 'em' });
    expect(nodes).toContainEqual({ type: 'speech', lang: 'de', text: 'Guten Morgen' });
    expect(nodes).toContainEqual(expect.objectContaining({ type: 'link', href: 'https://example.org' }));
    expect(inlineText(nodes)).toBe('Di hola ya y Guten Morgen o lee esto.');
  });

  it('no convierte en enlace nada que no sea http(s)', () => {
    const nodes = parseInline('[malo](javascript:alert(1))');
    expect(nodes.every((n) => typeof n === 'string')).toBe(true);
  });

  it('reconoce recuadros, ejercicios con respuesta, tablas, citas, listas y pausas', () => {
    const blocks = parseMarkdown(
      [
        ':::recreacion',
        'Una escena.',
        ':::',
        '',
        ':::ejercicio ¿Qué artículo lleva «Haus»?',
        'Piensa.',
        '???',
        '*das Haus*',
        ':::',
        '',
        '| Caso | Artículo |',
        '| --- | --- |',
        '| Nominativ | der |',
        '',
        '> Una cita',
        '',
        '1. uno',
        '2. dos',
        '',
        '---',
      ].join('\n'),
    );
    expect(blocks.map((b) => b.type)).toEqual(['callout', 'exercise', 'table', 'quote', 'list', 'break']);
    expect(blocks[0].kind).toBe('recreacion');
    expect(blocks[1].answer[0].type).toBe('paragraph');
    expect(blocks[2].rows).toHaveLength(1);
    expect(blocks[4].ordered).toBe(true);
  });

  it('extrae secciones, glosario, fuentes y palabras sin contar la bibliografía', () => {
    const source = [
      '---',
      'id: x',
      '---',
      'Intro de cuatro palabras.',
      '## Uno',
      'Dos palabras.',
      '## Conceptos importantes',
      '- **Átomo**: unidad de materia.',
      '## Fuentes y lecturas',
      '- Autor, *Libro* con muchas palabras que no cuentan.',
    ].join('\n');
    const result = analyzeDocument(source);
    expect(result.sections.map((s) => s.id)).toEqual(['uno', 'conceptos-importantes', 'fuentes-y-lecturas']);
    expect(result.glossary).toEqual([{ term: 'Átomo', definition: 'unidad de materia.' }]);
    expect(result.sourceCount).toBe(1);
    expect(result.words).toBe(countWords('Intro de cuatro palabras. Uno Dos palabras. Conceptos importantes Átomo: unidad de materia.'));
    expect(result.hasIntro).toBe(true);
  });
});
