import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

type SlidePanelSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type SlidePanelSide = 'left' | 'right';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: SlidePanelSize;
  side?: SlidePanelSide;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const sizeClasses: Record<SlidePanelSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const SlidePanel: React.FC<SlidePanelProps> = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  side = 'right',
  children,
  footer,
  className,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          'relative w-full h-full bg-[var(--surface)] shadow-[var(--shadow-xl)] flex flex-col',
          side === 'right' ? 'ml-auto border-l border-[var(--border)] animate-slide-in-right' : 'mr-auto border-r border-[var(--border)]',
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-5 pb-4 border-b border-[var(--border)] flex-shrink-0">
            <div>
              {title && (
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
              )}
              {description && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--surface-secondary)] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
