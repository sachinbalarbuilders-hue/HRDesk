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
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`block w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${
            checked 
              ? 'bg-[var(--gold-500)]' 
              : 'bg-[var(--rule)] dark:bg-[var(--surface-overlay)]'
          }`}
        ></div>
        <div
          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
            checked ? 'transform translate-x-4' : ''
          }`}
        ></div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={`text-sm font-medium transition-colors ${checked ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] group-hover:text-[var(--ink)]'}`}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[var(--ink-muted)]">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
};
