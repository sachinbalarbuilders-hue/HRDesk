import React from 'react';
import { Archive, CheckCircle2, Layers } from 'lucide-react';

export type ArchiveFilterValue = 'active' | 'archived' | 'all';

export interface ArchiveToggleProps {
  value: ArchiveFilterValue;
  onChange: (val: ArchiveFilterValue) => void;
  activeCount?: number;
  archivedCount?: number;
  allCount?: number;
}

export const ArchiveToggle: React.FC<ArchiveToggleProps> = ({
  value,
  onChange,
  activeCount,
  archivedCount,
  allCount,
}) => {
  return (
    <div className="inline-flex items-center p-1 bg-[var(--surface-secondary)] border border-[var(--border-strong)] rounded-lg text-sm">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
          value === 'active'
            ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-semibold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-normal'
        }`}
        title="Show Active Records Only"
      >
        <CheckCircle2 size={14} className={value === 'active' ? 'text-emerald-600' : 'text-[var(--text-secondary)]'} />
        <span>Active</span>
        {activeCount !== undefined && (
          <span className=" text-xs px-1.5 py-0.2 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-primary)]">
            {activeCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange('archived')}
        className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
          value === 'archived'
            ? 'bg-[var(--surface)] text-amber-700 dark:text-amber-300 shadow-xs font-semibold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-normal'
        }`}
        title="Show Archived Records"
      >
        <Archive size={14} className={value === 'archived' ? 'text-amber-600' : 'text-[var(--text-secondary)]'} />
        <span>Archived</span>
        {archivedCount !== undefined && (
          <span className=" text-xs px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
            {archivedCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange('all')}
        className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
          value === 'all'
            ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-semibold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-normal'
        }`}
        title="Show All Records"
      >
        <Layers size={14} className={value === 'all' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
        <span>All</span>
        {allCount !== undefined && (
          <span className=" text-xs px-1.5 py-0.2 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-primary)]">
            {allCount}
          </span>
        )}
      </button>
    </div>
  );
};
