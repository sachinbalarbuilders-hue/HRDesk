import React from 'react';
import { clsx } from 'clsx';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  className,
}) => {
  return (
    <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-[var(--text-primary)] truncate text-balance">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5 text-pretty">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
};
