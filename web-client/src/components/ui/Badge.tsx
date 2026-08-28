import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--accent-light)] text-[var(--accent)]',
  success: 'bg-[var(--success-light)] text-[var(--success)]',
  warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-light)] text-[var(--danger)]',
  info: 'bg-[var(--info-light)] text-[var(--info)]',
  neutral: 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--accent)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  info: 'bg-[var(--info)]',
  neutral: 'bg-[var(--text-muted)]',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className,
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-[var(--radius-full)]',
        variantStyles[variant],
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  );
};
