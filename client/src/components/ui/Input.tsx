import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  icon,
  suffix,
  className,
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-primary)]">
          {label}
          {props.required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          className={clsx(
            'register-input',
            icon && 'pl-9',
            suffix && 'pr-9',
            error && 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)]',
            className
          )}
          {...props}
        />

        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {suffix}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-[var(--danger)]">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-[11px] text-[var(--text-muted)]">{helperText}</p>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: Array<{ label: string; value: string | number }>;
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  options,
  className,
  id,
  ...props
}) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-[var(--text-primary)]">
          {label}
          {props.required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      <select
        id={selectId}
        className={clsx(
          'register-input',
          error && 'border-[var(--danger)]',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-[var(--text-muted)]">{helperText}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  className,
  id,
  ...props
}) => {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-medium text-[var(--text-primary)]">
          {label}
          {props.required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        className={clsx(
          'register-input min-h-[80px] resize-y',
          error && 'border-[var(--danger)]',
          className
        )}
        {...props}
      />

      {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-[var(--text-muted)]">{helperText}</p>}
    </div>
  );
};
