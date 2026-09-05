import React, { useMemo, useRef, useEffect } from 'react';
import { TableSkeleton } from './PageSkeleton';
import { PaginationToolbar } from './PaginationToolbar';
import { X, Check } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface BulkAction<T = any> {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'warning' | 'outline' | 'default';
  disabled?: boolean;
  onClick: (selectedKeys: (string | number)[], selectedRows: T[], clearSelection: () => void) => void;
}

export interface TableSelection<T = any> {
  selectedRowKeys: (string | number)[];
  onChange: (keys: (string | number)[], selectedRows: T[]) => void;
  getCheckboxProps?: (item: T) => { disabled?: boolean };
  bulkActions?: BulkAction<T>[];
  renderBulkActions?: (selectedKeys: (string | number)[], selectedRows: T[], clearSelection: () => void) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  showSrNo?: boolean;
  emptyMessage?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  selection?: TableSelection<T>;
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
  keyExtractor = (item, index) => item.id || item.candidateId || item.employeeId || index,
  selection,
  pagination,
}: DataTableProps<T>) {
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const selectedKeysSet = useMemo(
    () => new Set(selection?.selectedRowKeys ?? []),
    [selection?.selectedRowKeys]
  );

  const selectableRows = useMemo(() => {
    if (!selection) return [];
    return data.filter(item => !selection.getCheckboxProps?.(item)?.disabled);
  }, [data, selection]);

  const allSelectableKeys = useMemo(() => {
    return selectableRows.map((item, idx) => keyExtractor(item, idx));
  }, [selectableRows, keyExtractor]);

  const allSelected = useMemo(() => {
    if (selectableRows.length === 0) return false;
    return allSelectableKeys.every(k => selectedKeysSet.has(k));
  }, [selectableRows, allSelectableKeys, selectedKeysSet]);

  const isIndeterminate = useMemo(() => {
    if (selectableRows.length === 0 || allSelected) return false;
    return allSelectableKeys.some(k => selectedKeysSet.has(k));
  }, [selectableRows, allSelected, allSelectableKeys, selectedKeysSet]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggleSelectAll = () => {
    if (!selection) return;
    if (allSelected) {
      const remainingKeys = (selection.selectedRowKeys ?? []).filter(k => !allSelectableKeys.includes(k));
      const remainingRows = data.filter(item => remainingKeys.includes(keyExtractor(item, 0)));
      selection.onChange(remainingKeys, remainingRows);
    } else {
      const combinedKeys = Array.from(new Set([...(selection.selectedRowKeys ?? []), ...allSelectableKeys]));
      const selectedItems = data.filter(item => combinedKeys.includes(keyExtractor(item, 0)));
      selection.onChange(combinedKeys, selectedItems);
    }
  };

  const handleToggleRow = (item: T, index: number) => {
    if (!selection) return;
    const key = keyExtractor(item, index);
    let newKeys: (string | number)[];
    if (selectedKeysSet.has(key)) {
      newKeys = (selection.selectedRowKeys ?? []).filter(k => k !== key);
    } else {
      newKeys = [...(selection.selectedRowKeys ?? []), key];
    }
    const selectedItems = data.filter(row => newKeys.includes(keyExtractor(row, 0)));
    selection.onChange(newKeys, selectedItems);
  };

  const clearSelection = () => {
    selection?.onChange([], []);
  };

  const effectiveColumns: ColumnDef<T>[] = useMemo(() => {
    const cols: ColumnDef<T>[] = [];

    // 1. Checkbox Selection Column
    if (selection) {
      const selectCol: ColumnDef<T> = {
        key: '_select',
        header: (
          <input
            ref={selectAllCheckboxRef}
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleSelectAll}
            className="rounded border-[var(--rule)] cursor-pointer"
            title="Select / Deselect all"
            aria-label="Select or deselect all rows"
          />
        ),
        width: '40px',
        align: 'center',
        className: 'w-10 text-center',
        render: (item: T, index: number) => {
          const key = keyExtractor(item, index);
          const isChecked = selectedKeysSet.has(key);
          const checkboxProps = selection.getCheckboxProps?.(item);
          return (
            <input
              type="checkbox"
              checked={isChecked}
              disabled={checkboxProps?.disabled}
              onChange={() => handleToggleRow(item, index)}
              className="rounded border-[var(--rule)] cursor-pointer"
              aria-label={`Select row ${index + 1}`}
            />
          );
        },
      };
      cols.push(selectCol);
    }

    // 2. Serial Number Column
    if (showSrNo !== false && !columns.some(c => c.key === 'srNo' || c.key === 'sr' || c.key === '_srNo')) {
      const srCol: ColumnDef<T> = {
        key: '_srNo',
        header: 'Sr.',
        width: '50px',
        align: 'center',
        className: 'font-mono text-xs text-[var(--ink-muted)] w-12 text-center',
        render: (_: T, index: number) => {
          const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0;
          return <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">{offset + index + 1}</span>;
        },
      };
      cols.push(srCol);
    }

    return [...cols, ...columns];
  }, [columns, selection, showSrNo, allSelected, selectedKeysSet, pagination?.page, pagination?.pageSize, keyExtractor]);

  const selectedRows = useMemo(() => {
    if (!selection || selectedKeysSet.size === 0) return [];
    return data.filter((item, idx) => selectedKeysSet.has(keyExtractor(item, idx)));
  }, [selection, data, selectedKeysSet, keyExtractor]);

  return (
    <div className="space-y-2 font-ui">
      {/* ── Built-in Bulk Action Bar ────────────────────────────────────────── */}
      {selection && selectedKeysSet.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 bg-[var(--accent-light)] dark:bg-[var(--accent)]/15 border border-[var(--accent)]/40 rounded-[4px] text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-[2px] bg-[var(--gold-500)] text-[var(--navy-900)] font-bold text-[11px] tabular-nums">
              {selectedKeysSet.size}
            </span>
            <span className="font-semibold text-[var(--ink)]">
              item{selectedKeysSet.size !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selection.renderBulkActions ? (
              selection.renderBulkActions(selection.selectedRowKeys, selectedRows, clearSelection)
            ) : (
              selection.bulkActions?.map((action, idx) => {
                const variantClasses =
                  action.variant === 'danger'
                    ? 'btn-outline text-rose-600 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                    : action.variant === 'primary'
                    ? 'btn-primary'
                    : 'btn-outline';

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => action.onClick(selection.selectedRowKeys, selectedRows, clearSelection)}
                    className={`${variantClasses} flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold cursor-pointer`}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                );
              })
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] rounded-[2px] cursor-pointer transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X size={13} aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Table Container ─────────────────────────────────────────────────── */}
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
                data.map((item, index) => {
                  const key = keyExtractor(item, index);
                  const isSelected = selectedKeysSet.has(key);

                  return (
                    <tr
                      key={key}
                      className={`
                        transition-colors
                        ${isSelected ? 'bg-[var(--accent-light)]/70 dark:bg-[var(--accent)]/10' : 'hover:bg-[var(--paper-subtle)]'}
                      `}
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
                  );
                })
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

        {/* ── Reusable Pagination ────────────────────────────────────────────── */}
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
    </div>
  );
}
