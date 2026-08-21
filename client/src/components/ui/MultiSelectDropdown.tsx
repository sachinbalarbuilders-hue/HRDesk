import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

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
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  className,
  required = false
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleOption = (value: string | number) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const removeOption = (e: React.MouseEvent, value: string | number) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  const selectedOptions = options.filter(opt => selectedValues.includes(opt.value));

  return (
    <div className={clsx("space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className="block font-medium text-[var(--ink)] mb-1">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}
      
      <div className="relative">
        <div 
          className="register-input min-h-[38px] max-h-28 overflow-y-auto flex flex-wrap items-center gap-1.5 py-1.5 px-3 cursor-pointer bg-white"
          onClick={() => setOpen(!open)}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-[var(--ink-muted)] flex-1 text-sm">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedOptions.map(opt => (
                <span 
                  key={opt.value} 
                  className="inline-flex items-center gap-1 bg-[var(--surface-hover)] border border-[var(--rule)] rounded-[4px] px-2 py-0.5 text-xs text-[var(--ink)]"
                >
                  {opt.label}
                  <button 
                    type="button" 
                    onClick={(e) => removeOption(e, opt.value)}
                    className="text-[var(--ink-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <ChevronDown size={16} className="text-[var(--ink-muted)] ml-2 shrink-0 self-start mt-1" />
        </div>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] shadow-lg z-50 max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="p-3 text-center text-sm text-[var(--ink-muted)]">No options available</div>
            ) : (
              <ul className="py-1">
                {options.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <li 
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface-hover)] transition-colors",
                        isSelected && "bg-[var(--surface)] font-medium text-[var(--ink)]"
                      )}
                    >
                      <div className={clsx(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        isSelected ? "bg-[var(--ink)] border-[var(--ink)] text-white" : "border-[var(--rule)] bg-white"
                      )}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
