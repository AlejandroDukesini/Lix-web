import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Los estilos globales van primero: los de cada pantalla se cargan después y pueden refinarlos.
import './styles/index.css';
import { App } from './app/App.jsx';
import { initPwa } from './services/pwa/pwaStore.js';

// Antes de montar React para no perder `beforeinstallprompt`, que puede llegar muy pronto.
initPwa();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
