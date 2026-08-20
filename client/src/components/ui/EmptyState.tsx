import React from 'react';
import { clsx } from 'clsx';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="w-14 h-14 rounded-[var(--radius-full)] bg-[var(--surface-secondary)] flex items-center justify-center mb-4">
        {icon || <Inbox size={24} className="text-[var(--text-muted)]" />}
      </div>

      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h3>

      {description && (
        <p className="text-xs text-[var(--text-secondary)] max-w-[280px] leading-relaxed">{description}</p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary mt-4 text-xs flex items-center gap-1.5"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
};
