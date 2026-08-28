import React from 'react';
import { TableSkeleton } from './PageSkeleton';
import { PaginationToolbar } from './PaginationToolbar';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  showSrNo?: boolean;
  emptyMessage?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  showSrNo = true,
  emptyMessage = 'No records found.',
  keyExtractor = (item, index) => item.id || item.employeeId || index,
  pagination,
}: DataTableProps<T>) {
  const effectiveColumns: ColumnDef<T>[] = React.useMemo(() => {
    if (showSrNo === false || columns.some(c => c.key === 'srNo' || c.key === 'sr' || c.key === '_srNo')) {
      return columns;
    }
    const srCol: ColumnDef<T> = {
      key: '_srNo',
      header: 'Sr.',
      width: '50px',
      align: 'center',
      className: 'font-mono text-xs text-[var(--ink-muted)] w-12 text-center',
      render: (_: T, index: number) => {
        const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0;
        return <span className="font-mono text-xs text-[var(--ink-muted)]">{offset + index + 1}</span>;
      }
    };
    return [srCol, ...columns];
  }, [columns, showSrNo, pagination?.page, pagination?.pageSize]);

  return (
    <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="register-table w-full">
          <thead>
            <tr>
              {effectiveColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.className || ''}
                  `}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={effectiveColumns.length} className="p-0">
                  <TableSkeleton rows={6} />
                </td>
              </tr>
            ) : data.length > 0 ? (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  className="hover:bg-[var(--paper-subtle)] transition-colors"
                >
                  {effectiveColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                        ${col.className || ''}
                      `}
                    >
                      {col.render
                        ? col.render(item, index)
                        : (item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={effectiveColumns.length}
                  className="py-12 text-center text-xs text-[var(--ink-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reusable Pagination */}
      {pagination && pagination.totalCount > 0 && (
        <div className="border-t border-[var(--rule)] p-2 bg-[var(--surface)]">
          <PaginationToolbar
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
