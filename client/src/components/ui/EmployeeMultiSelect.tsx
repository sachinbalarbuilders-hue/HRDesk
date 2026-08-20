import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Avatar } from './Avatar';
import { apiClient } from '../../api/client';

interface Employee {
  employeeId: number;
  employeeName: string;
  employeeCode?: string;
  photoPath?: string | null;
}

interface EmployeeMultiSelectProps {
  label?: string;
  selectedIds: number[];
  selectedEmployees?: Employee[];
  onChange: (ids: number[], employees: Employee[]) => void;
  required?: boolean;
  pageSize?: number;
  branchId?: string | number | null;
}

export const EmployeeMultiSelect: React.FC<EmployeeMultiSelectProps> = ({
  label = 'Employee',
  selectedIds,
  selectedEmployees: initialSelected = [],
  onChange,
  required = false,
  pageSize = 20,
  branchId,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedCache, setSelectedCache] = useState<Employee[]>(initialSelected);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch employees from API
  const fetchEmployees = useCallback(async (searchQuery: string, pageNum: number, append: boolean) => {
    try {
      setLoading(true);
      const res = await apiClient.get('/employees', {
        params: {
          search: searchQuery || undefined,
          branchId: branchId || undefined,
          page: pageNum,
          pageSize,
          status: 'active',
        },
      });
      const items: Employee[] = (res.data.items || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
        employeeCode: e.employeeCode || e.employeeId,
        photoPath: e.photoPath || null,
      }));
      
      if (append) {
        setEmployees(prev => [...prev, ...items]);
      } else {
        setEmployees(items);
      }
      setHasMore(items.length >= pageSize);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, pageSize]);

  // Load on open
  useEffect(() => {
    if (open) {
      setPage(1);
      setSearch('');
      fetchEmployees('', 1, false);
    }
  }, [open, fetchEmployees]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchEmployees(value, 1, false);
    }, 300);
  };

  // Infinite scroll
  const handleScroll = () => {
    if (!listRef.current || loading || !hasMore) return;
    const el = listRef.current;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchEmployees(search, nextPage, true);
    }
  };

  const toggle = (emp: Employee) => {
    const isSelected = selectedIds.includes(emp.employeeId);
    let newIds: number[];
    let newCache: Employee[];

    if (isSelected) {
      newIds = selectedIds.filter(x => x !== emp.employeeId);
      newCache = selectedCache.filter(x => x.employeeId !== emp.employeeId);
    } else {
      newIds = [...selectedIds, emp.employeeId];
      newCache = [...selectedCache, emp];
    }

    setSelectedCache(newCache);
    onChange(newIds, newCache);
  };

  const removeChip = (id: number) => {
    const newIds = selectedIds.filter(x => x !== id);
    const newCache = selectedCache.filter(x => x.employeeId !== id);
    setSelectedCache(newCache);
    onChange(newIds, newCache);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      {/* Input area with chips */}
      <div
        onClick={() => setOpen(!open)}
        className="min-h-[42px] px-3 py-2 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)] cursor-pointer flex flex-wrap items-center gap-1.5 hover:border-[var(--accent)]"
      >
        {selectedCache.length > 0 ? (
          <>
            {selectedCache.slice(0, 3).map(emp => (
              <span
                key={emp.employeeId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium"
              >
                {emp.employeeName.split(' ')[0]}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeChip(emp.employeeId); }}
                  className="hover:text-[var(--danger)] cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {selectedCache.length > 3 && (
              <span className="text-xs text-[var(--text-muted)]">+{selectedCache.length - 3} more</span>
            )}
          </>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">Select employees...</span>
        )}
        <ChevronDown size={14} className="ml-auto text-[var(--text-muted)] flex-shrink-0" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden animate-slide-down">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
            <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or ID..."
              className="flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              autoFocus
            />
            {selectedIds.length > 0 && (
              <span className="text-[11px] text-[var(--accent)] font-medium">{selectedIds.length} selected</span>
            )}
          </div>

          {/* List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto"
            onScroll={handleScroll}
          >
            {employees.length === 0 && !loading ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No employees found</div>
            ) : (
              employees.map(emp => {
                const isSelected = selectedIds.includes(emp.employeeId);
                return (
                  <div
                    key={emp.employeeId}
                    onClick={() => toggle(emp)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-secondary)] ${isSelected ? 'bg-[var(--accent-light)]' : ''}`}
                  >
                    <div className="w-5 flex items-center justify-center flex-shrink-0">
                      {isSelected && <span className="text-[var(--accent)] font-bold">✓</span>}
                    </div>
                    <Avatar name={emp.employeeName} size="sm" src={emp.photoPath ? `/Thumbnail?employeeId=${emp.employeeId}` : null} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{emp.employeeName}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">EMP#{String(emp.employeeId).padStart(3, '0')}</p>
                    </div>
                  </div>
                );
              })
            )}

            {loading && (
              <div className="px-3 py-2 text-center text-xs text-[var(--text-muted)]">Loading...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
