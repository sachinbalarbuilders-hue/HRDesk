import React from 'react';
import { Search, Download, Upload } from 'lucide-react';
import { ArchiveToggle, type ArchiveFilterValue } from './ArchiveToggle';

export interface FilterOption {
  value: string;
  label: string;
}

export interface DataFilter {
  id: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  ariaLabel?: string;
}

export interface ArchiveFilterConfig {
  value: ArchiveFilterValue;
  onChange: (val: ArchiveFilterValue) => void;
  activeCount?: number;
  archivedCount?: number;
  allCount?: number;
}

export interface DataToolbarProps {
  // Search
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;

  // Archive Filter Toggle
  archiveFilter?: ArchiveFilterConfig;

  // Dropdown Filters
  filters?: DataFilter[];

  // Custom Controls (e.g., Month switcher, Date picker, View toggles)
  children?: React.ReactNode;

  // Export / Import Actions
  onExport?: () => void;
  exportLabel?: string;
  onImport?: () => void;
  importLabel?: string;

  // Custom Actions (e.g., Prefix Setup, Print)
  customActions?: React.ReactNode;

  // Primary Call-to-Action
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
}

export const DataToolbar: React.FC<DataToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  archiveFilter,
  filters = [],
  children,
  onExport,
  exportLabel = 'Export CSV',
  onImport,
  importLabel = 'Import CSV',
  customActions,
  primaryAction,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 font-ui mb-4">
      {/* Left side: Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
        {/* Search Input */}
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] shadow-xs transition-shadow"
            />
          </div>
        )}

        {/* Dynamic Filters (styled as SaaS chips) */}
        {filters.map((filter) => (
          <div key={filter.id} className="relative group">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              aria-label={filter.ariaLabel || filter.id}
              className={`appearance-none pl-3 pr-8 py-1.5 rounded-full border text-[13px] font-medium focus:outline-none cursor-pointer transition-colors shadow-xs ${
                filter.value && filter.value !== 'all'
                  ? 'bg-[var(--accent-light)] border-[var(--accent)]/30 text-[var(--accent-dark)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
              }`}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--surface)] text-[var(--text-primary)]">
                  {opt.label}
                </option>
              ))}
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        ))}

        {/* Custom Section Controls */}
        {children}
      </div>

      {/* Right side: Actions & Archive */}
      <div className="flex flex-col items-end gap-3 ml-auto flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {customActions}

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-2 text-[13px] font-medium py-1.5 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] shadow-xs transition-colors cursor-pointer"
              title={exportLabel}
            >
              <Download size={14} />
              <span>{exportLabel}</span>
            </button>
          )}

          {onImport && (
            <button
              type="button"
              onClick={onImport}
              className="flex items-center gap-2 text-[13px] font-medium py-1.5 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] shadow-xs transition-colors cursor-pointer"
              title={importLabel}
            >
              <Upload size={14} />
              <span>{importLabel}</span>
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="btn-primary flex items-center gap-1.5 text-[13px] py-1.5 px-3 cursor-pointer"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>

        {/* Bottom row: Archive Toggle */}
        {archiveFilter && (
          <ArchiveToggle
            value={archiveFilter.value}
            onChange={archiveFilter.onChange}
            activeCount={archiveFilter.activeCount}
            archivedCount={archiveFilter.archivedCount}
            allCount={archiveFilter.allCount}
          />
        )}
      </div>
    </div>
  );
};
