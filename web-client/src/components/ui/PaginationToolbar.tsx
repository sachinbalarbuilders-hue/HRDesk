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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--rule)] bg-[var(--surface-header)] text-xs select-none font-ui">
      {/* Range summary & Page size picker */}
      <div className="flex items-center gap-3 text-[var(--ink-muted)]">
        <span className="font-ui text-xs">
          Showing <strong className="text-[var(--ink)] font-data font-semibold">{startRecord}</strong> to{' '}
          <strong className="text-[var(--ink)] font-data font-semibold">{endRecord}</strong> of{' '}
          <strong className="text-[var(--ink)] font-data font-semibold">{totalCount}</strong> records
        </span>

        <div className="hidden sm:flex items-center gap-1.5 ml-3">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-muted)]">
            Rows per page:
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="px-2 py-0.5 rounded-[2px] bg-[var(--surface)] border border-[var(--rule)] text-xs font-semibold font-data text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] cursor-pointer"
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
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <span className="text-[var(--ink-muted)] mr-2 text-xs">
          Page <strong className="text-[var(--ink)] font-data font-semibold">{page}</strong> of{' '}
          <strong className="text-[var(--ink)] font-data font-semibold">{totalPages}</strong>
        </span>

        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="p-1 rounded-[2px] border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--ink)] cursor-pointer transition-colors"
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1 rounded-[2px] border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--ink)] cursor-pointer transition-colors"
          title="Previous Page"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1 rounded-[2px] border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--ink)] cursor-pointer transition-colors"
          title="Next Page"
        >
          <ChevronRight size={14} />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="p-1 rounded-[2px] border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--ink)] cursor-pointer transition-colors"
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};
