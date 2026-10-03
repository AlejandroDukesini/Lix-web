/**
 * Categorías del Game Center. Un juego puede pertenecer a varias.
 * Una categoría sin juegos disponibles no aparece en los filtros (sí en la hoja de ruta).
 */
import { Brain, Compass, Crown, Flag, Gem, Joystick, Telescope, Zap } from 'lucide-react';

export const CATEGORIES = Object.freeze([
  { id: 'aventura', label: 'Aventura', icon: Compass },
  { id: 'habilidad', label: 'Habilidad', icon: Zap },
  { id: 'logica', label: 'Lógica', icon: Brain },
  { id: 'estrategia', label: 'Estrategia', icon: Crown },
  { id: 'carreras', label: 'Carreras', icon: Flag },
  { id: 'arcade', label: 'Arcade', icon: Joystick },
  { id: 'clasicos', label: 'Clásicos', icon: Gem },
  { id: 'exploracion', label: 'Exploración', icon: Telescope },
]);

export const categoryById = (id) => CATEGORIES.find((category) => category.id === id) ?? null;
export const categoryLabel = (id) => categoryById(id)?.label ?? id;
