import React from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;

  title?: string;
  /** Main body copy. Keep it factual — say exactly what will happen. */
  message?: React.ReactNode;
  /** Name of the record, rendered in bold inside the default message. */
  itemName?: string;

  confirmLabel?: string;
  cancelLabel?: string;

  /**
   * 'danger' renders the red irreversible treatment plus a "This cannot be undone" banner.
   * Use it for permanent deletion only.
   */
  tone?: 'danger' | 'default';

  busy?: boolean;
}

/**
 * Shared confirmation modal. Replaces native window.confirm() so the irreversible
 * permanent-delete path gets a real, unmissable warning.
 *
 * Archiving does NOT use this — archiving is reversible, so it happens on one click.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
}) => {
  const isDanger = tone === 'danger';

  const resolvedTitle = title ?? (isDanger ? 'Permanently delete?' : 'Are you sure?');
  const resolvedConfirm = confirmLabel ?? (isDanger ? 'Delete permanently' : 'Confirm');

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-[var(--danger-light)] text-[var(--danger)]'
                : 'bg-[var(--warning-light)] text-[var(--warning)]'
            }`}
          >
            {isDanger ? <Trash2 size={17} /> : <AlertTriangle size={17} />}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{resolvedTitle}</h3>
            <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {message ?? (
                <>
                  {itemName ? (
                    <>
                      <span className="font-semibold text-[var(--text-primary)]">{itemName}</span>{' '}
                      will be permanently removed from the database.
                    </>
                  ) : (
                    <>This record will be permanently removed from the database.</>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {isDanger && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--danger-light)] border border-[var(--danger)]/25">
            <AlertTriangle size={13} className="text-[var(--danger)] shrink-0" />
            <span className="text-[11px] font-semibold text-[var(--danger)]">
              This cannot be undone.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary text-xs">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-md)] text-white disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: isDanger ? 'var(--danger)' : 'var(--accent)' }}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </Modal>
  );
};
