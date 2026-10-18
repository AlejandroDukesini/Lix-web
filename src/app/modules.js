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
import { CalendarHeart, Gamepad2, HeartPulse, House, LayoutDashboard, Library, NotebookPen, Settings, StickyNote, Wallet } from 'lucide-react';

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
    label: 'Biblioteca',
    icon: Library,
    status: 'available',
    teaser: 'Historias que enseñan: cosmos, criminalística, idiomas y creencias, sin conexión.',
  },
  {
    id: 'organizer',
    path: '/organizar',
    label: 'Organización',
    icon: LayoutDashboard,
    status: 'available',
    group: 'organizer',
    teaser: 'Tu día de un vistazo: clases, tareas, pagos y accesos rápidos.',
  },
  {
    id: 'calendar',
    path: '/calendario',
    label: 'Calendario',
    icon: CalendarHeart,
    status: 'available',
    group: 'organizer',
    teaser: 'Eventos, universidad, tareas y recordatorios en un mismo lugar.',
  },
  {
    id: 'finance',
    path: '/finanzas',
    label: 'Finanzas',
    icon: Wallet,
    status: 'available',
    group: 'organizer',
    teaser: 'Cuentas, gastos, presupuestos, metas y pagos, con calma.',
  },
  {
    id: 'notes',
    path: '/notas',
    label: 'Notas',
    icon: StickyNote,
    status: 'available',
    group: 'organizer',
    teaser: 'Un bloc de notas libre, con carpetas, etiquetas y papelera.',
  },
  {
    id: 'journal',
    path: '/diario',
    label: 'Diario',
    icon: NotebookPen,
    status: 'available',
    group: 'organizer',
    teaser: 'Lo que vives, pensado y escrito a tu ritmo.',
  },
  {
    id: 'emotions',
    path: '/emociones',
    label: 'Diario emocional',
    icon: HeartPulse,
    status: 'available',
    group: 'organizer',
    teaser: 'Reconocer lo que sientes y verlo con el tiempo, sin juicios.',
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
