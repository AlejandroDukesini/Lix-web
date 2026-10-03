import { Link } from 'react-router';
import { cx } from '../../utils/cx.js';

/**
 * Botón de la app. Con `to` se renderiza como enlace interno con el mismo aspecto;
 * con `href`, como enlace externo (siempre en otra pestaña y sin `opener` ni referer).
 * variant: primary | secondary | ghost | danger    size: sm | md | lg
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconEnd: IconEnd,
  to,
  href,
  className,
  children,
  type = 'button',
  ref,
  ...rest
}) {
  const classes = cx('btn', `btn--${variant}`, `btn--${size}`, className);
  const content = (
    <>
      {Icon && <Icon className="btn__icon" aria-hidden="true" />}
      <span className="btn__label">{children}</span>
      {IconEnd && <IconEnd className="btn__icon" aria-hidden="true" />}
    </>
  );

  if (href !== undefined) {
    return (
      <a ref={ref} href={href} className={classes} target="_blank" rel="noopener noreferrer" {...rest}>
        {content}
      </a>
    );
  }
  if (to !== undefined) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {content}
    </button>
  );
}

/** Botón solo con icono: `label` es obligatorio y se usa como nombre accesible y tooltip nativo. */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className, ref, ...rest }) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('icon-btn', `icon-btn--${variant}`, `icon-btn--${size}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
