import { cx } from '../../utils/cx.js';

/** Superficie base. Su aspecto (cristal o maximalista) lo deciden los tokens del estilo activo. */
export function Card({ as: Tag = 'div', variant = 'default', className, children, ...rest }) {
  return (
    <Tag className={cx('card', variant !== 'default' && `card--${variant}`, className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx('badge', `badge--${tone}`, className)}>{children}</span>;
}

export function SectionHeader({ id, eyebrow, title, description, level = 2, action }) {
  const Heading = `h${level}`;
  return (
    <header className="section-header">
      <div className="section-header__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <Heading id={id} className="section-header__title">
          {title}
        </Heading>
        {description && <p className="section-header__description">{description}</p>}
      </div>
      {action && <div className="section-header__action">{action}</div>}
    </header>
  );
}
