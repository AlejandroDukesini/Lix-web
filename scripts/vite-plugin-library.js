/**
 * Plugin de Vite que construye el índice de la biblioteca a partir de sus documentos.
 *
 * Cada archivo `src/features/library/content/<estante>/<archivo>.md` es un
 * documento. El plugin los lee al compilar y expone el módulo virtual
 * `virtual:library-index` con los datos de todos (metadatos, palabras, minutos de
 * lectura, secciones y glosario), pero sin su texto: el catálogo, el buscador y el
 * glosario funcionan sin cargar los documentos, y cada documento se descarga solo
 * al abrirlo (el Service Worker los precachea todos igualmente para leer sin conexión).
 *
 * Añadir un documento = añadir su archivo .md. No hay que tocar ningún registro.
 * Funciona en `vite`, `vite build` y Vitest.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { analyzeDocument } from '../src/features/library/engine/markdown.js';

const VIRTUAL_ID = 'virtual:library-index';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const CONTENT_SUBDIR = 'src/features/library/content';
const defaultContentDir = (root = process.cwd()) => path.resolve(root, CONTENT_SUBDIR);

function listMarkdown(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

/** Índice de todos los documentos (lo usa también la prueba de contenido). */
export function buildLibraryIndex(contentDir = defaultContentDir()) {
  return listMarkdown(contentDir)
    .sort()
    .map((file) => {
      const analysis = analyzeDocument(readFileSync(file, 'utf8'));
      return {
        file: path.relative(contentDir, file).split(path.sep).join('/'),
        ...analysis.meta,
        words: analysis.words,
        minutes: analysis.minutes,
        sections: analysis.sections,
        hasIntro: analysis.hasIntro,
        glossary: analysis.glossary,
        sourceCount: analysis.sourceCount,
      };
    });
}

export function libraryIndex() {
  let contentDir = defaultContentDir();
  return {
    name: 'uamc-library-index',

    configResolved(config) {
      contentDir = defaultContentDir(config.root);
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_ID) return null;
      for (const file of listMarkdown(contentDir)) this.addWatchFile(file);
      return `export default ${JSON.stringify(buildLibraryIndex(contentDir))};`;
    },

    // En desarrollo, editar un documento actualiza el índice (títulos, minutos, glosario).
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.md') || !path.resolve(file).startsWith(contentDir)) return;
      const module = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (module) server.moduleGraph.invalidateModule(module);
    },
  };
}
