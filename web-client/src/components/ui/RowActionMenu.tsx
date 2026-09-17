import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
  dividerBefore?: boolean;
}

interface RowActionMenuProps {
  actions: RowAction[];
}

export const RowActionMenu: React.FC<RowActionMenuProps> = ({ actions }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const getCoordinates = useCallback(() => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth || 170;
    const menuHeight = menuRef.current?.offsetHeight || 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuHeight && rect.top > menuHeight;

    return {
      top: openAbove ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)),
    };
  }, []);

  // Position on open before browser paint
  useLayoutEffect(() => {
    if (open) {
      setPosition(getCoordinates());
    }
  }, [open, getCoordinates]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape or scroll
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const visibleActions = actions.filter(a => a !== null && a !== undefined);
  if (visibleActions.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) {
            setPosition(getCoordinates());
            setOpen(true);
          } else {
            setOpen(false);
          }
        }}
        className="p-1.5 rounded-[4px] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && position.top !== 0 && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[170px] bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-xl py-1"
          style={{ top: position.top, left: position.left }}
          role="menu"
        >
          {visibleActions.map((action, idx) => (
            <React.Fragment key={idx}>
              {action.dividerBefore && idx > 0 && (
                <div className="border-t border-[var(--border)] my-1" />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  action.onClick();
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors min-h-[36px] disabled:opacity-40 disabled:cursor-not-allowed ${
                  action.variant === 'danger'
                    ? 'text-[var(--danger)] hover:bg-[var(--danger-light)]'
                    : action.variant === 'success'
                    ? 'text-[var(--success)] hover:bg-[var(--success-light)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                {action.icon && <span className="flex-shrink-0" aria-hidden="true">{action.icon}</span>}
                <span className="font-normal">{action.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
