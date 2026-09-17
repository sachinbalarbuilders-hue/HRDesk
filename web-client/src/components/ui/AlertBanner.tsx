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
  let icon = <CheckCircle2 size={16} className="text-[var(--ok-600)] flex-shrink-0 mt-0.5" aria-hidden="true" />;
  let badgeText = 'SUCCESS';
  let badgeColor = 'text-[var(--ok-600)] bg-[var(--ok-600)]/10';

  if (type === 'error') {
    borderAccent = 'border-l-[var(--err-600)]';
    icon = <XCircle size={16} className="text-[var(--err-600)] flex-shrink-0 mt-0.5" aria-hidden="true" />;
    badgeText = 'FAILED';
    badgeColor = 'text-[var(--err-600)] bg-[var(--err-600)]/10';
  } else if (type === 'warning') {
    borderAccent = 'border-l-[var(--warn-600)]';
    icon = <AlertTriangle size={16} className="text-[var(--warn-600)] flex-shrink-0 mt-0.5" aria-hidden="true" />;
    badgeText = 'WARNING';
    badgeColor = 'text-[var(--warn-600)] bg-[var(--warn-600)]/10';
  } else if (type === 'info') {
    borderAccent = 'border-l-[var(--accent)]';
    icon = <Info size={16} className="text-[var(--accent)] flex-shrink-0 mt-0.5" aria-hidden="true" />;
    badgeText = 'NOTICE';
    badgeColor = 'text-[var(--accent)] bg-[var(--accent)]/10';
  }

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`bg-[var(--surface)] border border-[var(--rule)] border-l-4 ${borderAccent} rounded-[4px] p-3 flex items-start gap-2.5 ${className}`}
    >
      {icon}

      <div className="flex-1 min-w-0">
        {title && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`px-1 rounded-[2px] text-xs font-normal font-semibold  ${badgeColor}`}>
              {badgeText}
            </span>
            <p className="text-xs font-semibold text-[var(--text-primary)]  text-balance">
              {title}
            </p>
          </div>
        )}
        <p className="text-xs text-[var(--text-secondary)]  leading-snug text-pretty">
          {message}
        </p>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
