/**
 * Registro central de las áreas de la aplicación.
 *
 * La navegación (barra lateral, barra inferior, menú "Espacios") y el inicio se
 * generan a partir de esta lista. Para activar un módulo en una fase futura:
 *   1. Crea su carpeta en src/features/<módulo>/ con su página.
 *   2. Cambia aquí `status` a 'available'.
 *   3. Añade su <Route> en AppRoutes (App.jsx), con lazy() para cargarlo bajo demanda.
 * Un módulo 'soon' nunca genera una ruta: no es posible navegar a una pantalla inexistente.
 */
import { CalendarHeart, Gamepad2, House, Library, NotebookPen, Settings, Wallet } from 'lucide-react';

export const MODULES = [
  {
    id: 'home',
    path: '/',
    label: 'Inicio',
    icon: House,
    status: 'available',
  },
  {
    id: 'games',
    path: '/juegos',
    label: 'Juegos',
    icon: Gamepad2,
    status: 'available',
    teaser: 'Nuestra sala de juegos: carreras, lógica, ajedrez y arcade, sin conexión.',
  },
  {
    id: 'documentation',
    path: '/documentos',
    label: 'Documentación',
    icon: Library,
    status: 'soon',
    teaser: 'Una biblioteca para leer, buscar y guardar lo que queramos conservar.',
  },
  {
    id: 'journal',
    path: '/diario',
    label: 'Diario y notas',
    icon: NotebookPen,
    status: 'soon',
    teaser: 'Un diario, notas rápidas y recordatorios que se quedan solo aquí.',
  },
  {
    id: 'calendar',
    path: '/calendario',
    label: 'Calendario',
    icon: CalendarHeart,
    status: 'soon',
    teaser: 'Nuestras fechas, planes y recordatorios, todos en un mismo lugar.',
  },
  {
    id: 'finance',
    path: '/finanzas',
    label: 'Finanzas',
    icon: Wallet,
    status: 'soon',
    teaser: 'Un espacio para organizar gastos, metas y ahorros con calma.',
  },
  {
    id: 'settings',
    path: '/ajustes',
    label: 'Configuración',
    icon: Settings,
    status: 'available',
  },
];

export const UPCOMING_MODULES = MODULES.filter((module) => module.status === 'soon');
