import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) => {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} group`}>
      <div 
        className={`relative inline-flex h-[24px] w-[44px] flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
          checked ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-[var(--surface-overlay)]'
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <span
          className={`absolute left-[2px] top-[2px] pointer-events-none flex h-[20px] w-[20px] items-center justify-center transform rounded-full bg-white dark:bg-black shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-[20px]' : 'translate-x-0'
          }`}
        >
          {checked && (
            <svg className="w-3 h-3 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={`text-sm font-medium transition-colors ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[var(--text-secondary)]">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
};
