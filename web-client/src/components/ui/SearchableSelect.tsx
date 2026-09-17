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
  searchable?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  searchable = true,
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border transition-colors duration-150 text-left cursor-pointer ${
          disabled
            ? 'opacity-50 bg-[var(--paper)]/50 text-[var(--text-secondary)] border-[var(--rule)]/60 cursor-not-allowed'
            : isOpen
            ? 'bg-[var(--card)] border-[var(--accent)] shadow-sm ring-2 ring-[var(--accent)]/30 text-[var(--text-primary)]'
            : 'bg-[var(--paper)] border-[var(--rule)] hover:border-[var(--gold-400)] text-[var(--text-primary)] shadow-sm'
        } ${className}`}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown size={14} className="text-[var(--text-secondary)] shrink-0" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={placeholder}
          className="absolute left-0 z-50 mt-1 min-w-[220px] w-full bg-[var(--card)] text-[var(--text-primary)] rounded-lg shadow-2xl border border-[var(--rule)] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ease-out backdrop-blur-sm"
        >
          {/* Search Box */}
          {searchable && (
            <div className="px-2.5 py-1.5 border-b border-[var(--rule)] flex items-center gap-2 bg-[var(--paper)]/40">
              <Search size={14} className="text-[var(--text-secondary)] shrink-0" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Search options"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full text-xs bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
              />
            </div>
          )}

          {/* Option List */}
          <div className="max-h-52 overflow-y-auto py-1 divide-y divide-[var(--rule)]/20">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--text-secondary)] italic text-center">
                No matching options
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent)]/15 text-[var(--accent-hover)] dark:text-[var(--gold-400)] font-semibold'
                        : 'text-[var(--text-primary)] hover:bg-[var(--paper)]'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check size={14} className="text-[var(--accent-hover)] dark:text-[var(--gold-400)] shrink-0 ml-2" aria-hidden="true" />
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
