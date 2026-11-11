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
import { CalendarHeart, Flower2, Gamepad2, GraduationCap, Sparkles, HeartPulse, House, LayoutDashboard, Library, NotebookPen, Settings, StickyNote, Wallet } from 'lucide-react';

/** Grupos de la navegación (los módulos sin `group` van arriba, sueltos). */
export const NAV_GROUPS = [
  { id: 'organizer', label: 'Organización' },
  { id: 'studio', label: 'Taller creativo' },
];

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
    id: 'academic',
    path: '/academico',
    label: 'Control académico',
    icon: GraduationCap,
    status: 'available',
    group: 'organizer',
    teaser: 'Asignaturas, entregas, parciales, horario semanal, festivos y cuadernos.',
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
    id: 'flowers',
    path: '/flores',
    label: 'Lix Flowers',
    icon: Flower2,
    status: 'available',
    group: 'studio',
    teaser: 'Flores hechas de caracteres: plantillas o tus fotos, animadas con Python.',
  },
  {
    id: 'ai-studio',
    path: '/estudio',
    label: 'Lix AI Studio',
    icon: Sparkles,
    status: 'available',
    group: 'studio',
    teaser: 'Describe una imagen y créala: pintor procedural sin conexión o tu propio servidor de IA.',
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
