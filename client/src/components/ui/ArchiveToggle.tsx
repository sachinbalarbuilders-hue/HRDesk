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
    <div className="inline-flex items-center p-0.5 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] text-xs font-ui">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={`px-2.5 py-1 rounded-[2px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
          value === 'active'
            ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs font-semibold'
            : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
        title="Show Active Records Only"
      >
        <CheckCircle2 size={12} className={value === 'active' ? 'text-emerald-600' : 'text-[var(--ink-muted)]'} />
        <span>Active</span>
        {activeCount !== undefined && (
          <span className="font-data text-[10px] px-1 rounded-full bg-[var(--rule)]/50 text-[var(--ink)]">
            {activeCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange('archived')}
        className={`px-2.5 py-1 rounded-[2px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
          value === 'archived'
            ? 'bg-[var(--surface)] text-amber-700 dark:text-amber-300 shadow-xs font-semibold'
            : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
        title="Show Archived Records"
      >
        <Archive size={12} className={value === 'archived' ? 'text-amber-600' : 'text-[var(--ink-muted)]'} />
        <span>Archived</span>
        {archivedCount !== undefined && (
          <span className="font-data text-[10px] px-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
            {archivedCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange('all')}
        className={`px-2.5 py-1 rounded-[2px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
          value === 'all'
            ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs font-semibold'
            : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
        title="Show All Records"
      >
        <Layers size={12} className={value === 'all' ? 'text-[var(--gold-500)]' : 'text-[var(--ink-muted)]'} />
        <span>All</span>
        {allCount !== undefined && (
          <span className="font-data text-[10px] px-1 rounded-full bg-[var(--rule)]/50 text-[var(--ink)]">
            {allCount}
          </span>
        )}
      </button>
    </div>
  );
};
