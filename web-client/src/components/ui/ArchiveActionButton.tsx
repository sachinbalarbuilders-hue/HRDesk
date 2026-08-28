import React from 'react';
import { Archive, RotateCcw } from 'lucide-react';

export interface ArchiveActionButtonProps {
  isArchived: boolean;
  onArchive: () => void;
  onRestore: () => void;
  itemName?: string;
  className?: string;
}

export const ArchiveActionButton: React.FC<ArchiveActionButtonProps> = ({
  isArchived,
  onArchive,
  onRestore,
  itemName = 'record',
  className = '',
}) => {
  if (isArchived) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRestore();
        }}
        className={`p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-emerald-600 cursor-pointer transition-colors ${className}`}
        title={`Restore ${itemName}`}
        aria-label={`Restore ${itemName}`}
      >
        <RotateCcw size={13} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onArchive();
      }}
      className={`p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-amber-600 cursor-pointer transition-colors ${className}`}
      title={`Archive ${itemName}`}
      aria-label={`Archive ${itemName}`}
    >
      <Archive size={13} />
    </button>
  );
};
