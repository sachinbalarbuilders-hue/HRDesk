import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface MultiSelectOption {
  label: string;
  value: string | number;
}

interface MultiSelectDropdownProps {
  label?: string;
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  searchable?: boolean;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  className,
  required = false,
  searchable = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleOption = (value: string | number) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const removeChip = (e: React.MouseEvent, value: string | number) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  const selectedOptions = options.filter(opt => selectedValues.includes(opt.value));
  const filtered = search.trim()
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger */}
        <div
          className="min-h-[42px] px-3 py-2 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)] cursor-pointer flex flex-wrap items-center gap-1.5 hover:border-[var(--accent)]"
          onClick={() => { setOpen(!open); setSearch(''); }}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-sm text-[var(--text-muted)] flex-1">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedOptions.slice(0, 3).map(opt => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium"
                >
                  {opt.label}
                  <button
                    type="button"
                    onClick={(e) => removeChip(e, opt.value)}
                    className="hover:text-[var(--danger)] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {selectedOptions.length > 3 && (
                <span className="text-xs text-[var(--text-muted)]">+{selectedOptions.length - 3} more</span>
              )}
            </div>
          )}
          <ChevronDown size={14} className="ml-auto text-[var(--text-muted)] flex-shrink-0" />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden animate-slide-down">
            {/* Search */}
            {searchable && (
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
                <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  autoFocus
                />
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Options */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No options found</div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-secondary)] ${isSelected ? 'bg-[var(--accent-light)]' : ''}`}
                    >
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                          : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}>
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className="text-sm text-[var(--text-primary)]">{opt.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
