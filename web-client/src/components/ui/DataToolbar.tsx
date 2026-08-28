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
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] font-ui">
      {/* Left side: Search & Archive Toggle & Dropdown Filters & Custom Controls */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[320px]">
        {/* Search Input */}
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[150px] max-w-[260px]">
            <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--ink-muted)]" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
            />
          </div>
        )}

        {/* Dynamic Filters */}
        {filters.map((filter) => (
          <select
            key={filter.id}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={filter.ariaLabel || filter.id}
            className="px-2.5 py-1.5 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none font-ui cursor-pointer"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {/* Custom Section Controls */}
        {children}
      </div>

      {/* Right side: Export, Import, Primary Action */}
      <div className="flex flex-col items-end gap-2 ml-auto flex-shrink-0">
        {/* Top row of actions */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {customActions}

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-2.5 font-data cursor-pointer"
              title={exportLabel}
            >
              <Download size={13} />
              <span>{exportLabel}</span>
            </button>
          )}

          {onImport && (
            <button
              type="button"
              onClick={onImport}
              className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-2.5 font-data cursor-pointer"
              title={importLabel}
            >
              <Upload size={13} />
              <span>{importLabel}</span>
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 cursor-pointer"
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
