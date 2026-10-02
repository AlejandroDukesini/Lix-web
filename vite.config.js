import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlinePrecache } from './scripts/vite-plugin-offline.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Rutas relativas: el build funciona en cualquier carpeta o subruta local.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), offlinePrecache()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: false },
  build: {
    target: 'es2020',
    sourcemap: false,
    // Sin data: URIs para fuentes: todo se sirve como archivo y se precachea.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
  },
});
