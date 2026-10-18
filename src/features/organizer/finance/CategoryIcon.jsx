import {
  Baby,
  Book,
  Briefcase,
  Bus,
  Coffee,
  Coins,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Zap,
} from 'lucide-react';

export const CATEGORY_ICON_COMPONENTS = {
  tag: Tag,
  utensils: Utensils,
  bus: Bus,
  home: House,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  shirt: Shirt,
  gamepad: Gamepad2,
  gift: Gift,
  plane: Plane,
  phone: Smartphone,
  zap: Zap,
  'shopping-bag': ShoppingBag,
  coffee: Coffee,
  book: Book,
  paw: PawPrint,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  'piggy-bank': PiggyBank,
  coins: Coins,
  sparkles: Sparkles,
  film: Film,
  music: Music,
  baby: Baby,
};

/** Icono de una categoría sobre su color (o un icono genérico si no tiene). */
export function CategoryBadge({ category, fallbackIcon: Fallback = Tag, color }) {
  const Icon = CATEGORY_ICON_COMPONENTS[category?.icon] ?? Fallback;
  return (
    <span className="org-icon-badge" style={{ '--badge-color': color ?? category?.color ?? 'var(--c-secondary)' }} aria-hidden="true">
      <Icon />
    </span>
  );
}
