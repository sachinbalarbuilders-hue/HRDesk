import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type StatVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: StatVariant;
  trend?: { value: number; label?: string };
  subtitle?: string;
  className?: string;
}

const iconBgColors: Record<StatVariant, string> = {
  default: 'bg-[var(--accent-light)] text-[var(--accent)]',
  success: 'bg-[var(--success-light)] text-[var(--success)]',
  warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-light)] text-[var(--danger)]',
  info: 'bg-[var(--info-light)] text-[var(--info)]',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  variant = 'default',
  trend,
  subtitle,
  className,
}) => {
  return (
    <div
      className={clsx(
        'bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-data tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1 text-pretty">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value > 0 ? (
                <TrendingUp size={12} className="text-[var(--success)]" aria-hidden="true" />
              ) : trend.value < 0 ? (
                <TrendingDown size={12} className="text-[var(--danger)]" aria-hidden="true" />
              ) : (
                <Minus size={12} className="text-[var(--text-muted)]" aria-hidden="true" />
              )}
              <span
                className={clsx(
                  'text-[11px] font-medium tabular-nums',
                  trend.value > 0 && 'text-[var(--success)]',
                  trend.value < 0 && 'text-[var(--danger)]',
                  trend.value === 0 && 'text-[var(--text-muted)]'
                )}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-[11px] text-[var(--text-muted)]">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div
            className={clsx(
              'size-10 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0',
              iconBgColors[variant]
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
