import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Ban, ChevronDown } from 'lucide-react';

interface StatusRow {
  id: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Archived' | 'Cancelled' | string;
}

export interface StatusApprovalDropdownProps {
  row: StatusRow;
  canApprove: boolean;
  canCancel: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onCancel: (id: number) => void;
}

export const StatusApprovalDropdown: React.FC<StatusApprovalDropdownProps> = ({
  row,
  canApprove,
  canCancel,
  onApprove,
  onReject,
  onCancel,
}) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const getCoordinates = useCallback(() => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 128; // w-32 = 128px
    
    // We only have up to 3 buttons (Approve, Reject, Cancel)
    // Roughly 30px per button + padding
    const menuHeight = 100;
    
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuHeight && rect.top > menuHeight;

    return {
      top: openAbove ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.left)), // align left with button
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

  if (row.status === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>Approved</span>
      </span>
    );
  }

  if (row.status === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span>Rejected</span>
      </span>
    );
  }

  if (row.status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        <span>Cancelled</span>
      </span>
    );
  }

  if (row.status === 'Archived') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Archived</span>
      </span>
    );
  }

  // Pending Status
  if (!canApprove && !canCancel) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span>Pending</span>
      </span>
    );
  }

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
        className="inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-md text-sm font-semibold border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] shadow-2xs cursor-pointer transition-all hover:border-[var(--accent)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-semibold">Pending</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && position.top !== 0 && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-32 rounded-lg bg-[var(--paper)] border border-[var(--rule)] shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 font-sans"
          style={{ top: position.top, left: position.left }}
          role="menu"
        >
          {canApprove && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onApprove(row.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left cursor-pointer transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold">Approve</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onReject(row.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                <span className="font-semibold">Reject</span>
              </button>
            </>
          )}
          {canCancel && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onCancel(row.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer transition-colors"
            >
              <Ban className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-semibold">Cancel</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
};
