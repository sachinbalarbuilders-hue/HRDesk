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
            ? 'opacity-60 bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
            : isOpen
            ? 'bg-white dark:bg-gray-900 border-indigo-500 shadow-sm ring-1 ring-indigo-500/20 text-gray-900 dark:text-gray-100'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-900 dark:text-gray-100 shadow-xs'
        }`}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown size={14} className="text-gray-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[200px] w-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
            />
          </div>

          {/* Option List */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 italic text-center">
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
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
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
