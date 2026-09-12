import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationToolbarProps {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export const PaginationToolbar: React.FC<PaginationToolbarProps> = ({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 200],
}) => {
  if (totalCount === 0) return null;

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-4 text-[13px] select-none font-ui mt-2">
      {/* Range summary & Page size picker */}
      <div className="flex items-center gap-3 text-[var(--text-muted)]">
        <span>
          Showing <strong className="text-[var(--text-primary)] font-semibold tabular-nums">{startRecord}</strong> to{' '}
          <strong className="text-[var(--text-primary)] font-semibold tabular-nums">{endRecord}</strong> of{' '}
          <strong className="text-[var(--text-primary)] font-semibold tabular-nums">{totalCount}</strong> results
        </span>

        <div className="hidden sm:flex items-center gap-1.5 ml-3">
          <label htmlFor="pagination-rows-per-page" className="text-[12px] font-medium text-[var(--text-muted)]">
            Rows per page:
          </label>
          <select
            id="pagination-rows-per-page"
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[12px] font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Buttons & Page indicator */}
      {/* Navigation Buttons & Page indicator */}
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <span className="text-[var(--text-muted)] mr-3">
          Page <strong className="text-[var(--text-primary)] font-semibold tabular-nums">{page}</strong> of{' '}
          <strong className="text-[var(--text-primary)] font-semibold tabular-nums">{totalPages}</strong>
        </span>

        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="First page"
          className="p-1.5 rounded-md hover:bg-[var(--surface-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          title="First Page"
        >
          <ChevronsLeft size={16} aria-hidden="true" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="p-1.5 rounded-md hover:bg-[var(--surface-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          title="Previous Page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="p-1.5 rounded-md hover:bg-[var(--surface-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          title="Next Page"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Last page"
          className="p-1.5 rounded-md hover:bg-[var(--surface-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          title="Last Page"
        >
          <ChevronsRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
