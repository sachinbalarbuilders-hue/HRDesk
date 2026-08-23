import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, ChevronsUpDown } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: (string | SearchableSelectOption)[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions: SearchableSelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        className={`w-full min-w-[180px] max-w-[260px] flex items-center justify-between gap-2 px-3 py-1.5 text-xs rounded-md border transition-all duration-150 text-left cursor-pointer ${
          disabled
            ? 'opacity-50 bg-[var(--paper)]/50 text-[var(--ink-muted)] border-[var(--rule)]/60 cursor-not-allowed'
            : isOpen
            ? 'bg-[var(--card)] border-indigo-500 shadow-sm ring-1 ring-indigo-500/30 text-[var(--ink)]'
            : 'bg-[var(--card)] border-[var(--rule)] hover:border-indigo-400 dark:hover:border-indigo-600 text-[var(--ink)] shadow-xs'
        }`}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown size={14} className="text-[var(--ink-muted)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-[999] mt-1 min-w-[220px] w-full bg-[var(--card)] text-[var(--ink)] rounded-lg shadow-2xl border border-[var(--rule)] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 backdrop-blur-sm">
          {/* Search Box */}
          <div className="px-2.5 py-1.5 border-b border-[var(--rule)] flex items-center gap-2 bg-[var(--paper)]/40">
            <Search size={14} className="text-[var(--ink-muted)] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs bg-transparent border-none outline-none text-[var(--ink)] placeholder-[var(--ink-muted)]"
            />
          </div>

          {/* Option List */}
          <div className="max-h-52 overflow-y-auto py-1 divide-y divide-[var(--rule)]/20">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--ink-muted)] italic text-center">
                No matching options
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-[var(--ink)] hover:bg-[var(--paper)]'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
