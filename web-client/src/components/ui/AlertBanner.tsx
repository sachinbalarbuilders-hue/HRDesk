import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface AlertBannerProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  title,
  message,
  onDismiss,
  className = '',
}) => {
  let borderAccent = 'border-l-[var(--ok-600)]';
  let icon = <CheckCircle2 size={16} className="text-[var(--ok-600)] flex-shrink-0 mt-0.5" />;
  let badgeText = 'SUCCESS';
  let badgeColor = 'text-[var(--ok-600)] bg-[var(--ok-600)]/10';

  if (type === 'error') {
    borderAccent = 'border-l-[var(--err-600)]';
    icon = <XCircle size={16} className="text-[var(--err-600)] flex-shrink-0 mt-0.5" />;
    badgeText = 'FAILED';
    badgeColor = 'text-[var(--err-600)] bg-[var(--err-600)]/10';
  } else if (type === 'warning') {
    borderAccent = 'border-l-[var(--warn-600)]';
    icon = <AlertTriangle size={16} className="text-[var(--warn-600)] flex-shrink-0 mt-0.5" />;
    badgeText = 'WARNING';
    badgeColor = 'text-[var(--warn-600)] bg-[var(--warn-600)]/10';
  } else if (type === 'info') {
    borderAccent = 'border-l-[var(--gold-500)]';
    icon = <Info size={16} className="text-[var(--gold-500)] flex-shrink-0 mt-0.5" />;
    badgeText = 'NOTICE';
    badgeColor = 'text-[var(--gold-500)] bg-[var(--gold-500)]/10';
  }

  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--rule)] border-l-4 ${borderAccent} rounded-[4px] p-3 flex items-start gap-2.5 ${className}`}
    >
      {icon}

      <div className="flex-1 min-w-0">
        {title && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`px-1 rounded-[2px] text-[9px] font-bold font-data ${badgeColor}`}>
              {badgeText}
            </span>
            <p className="text-xs font-semibold text-[var(--ink)] font-ui">
              {title}
            </p>
          </div>
        )}
        <p className="text-xs text-[var(--ink-muted)] font-ui leading-snug">
          {message}
        </p>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-[var(--ink-muted)] hover:text-[var(--ink)] p-0.5 rounded cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
