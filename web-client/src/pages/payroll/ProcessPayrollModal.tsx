import React from 'react';
import { X, AlertCircle, Calculator } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
  skipLoans: boolean;
  onSkipLoansChange: (v: boolean) => void;
  processing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const ProcessPayrollModal: React.FC<Props> = ({
  open, onClose, selectedMonth, onMonthChange,
  skipLoans, onSkipLoansChange, processing, onSubmit,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
      <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
        <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Run Payroll</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Calculate earnings, LOP deductions, and loan installments.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
              Processing Month *
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => onMonthChange(e.target.value)}
              className="register-input font-data"
              required
            />
          </div>

          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!skipLoans}
                onChange={e => onSkipLoansChange(!e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--accent)]"
              />
              <span className="text-sm font-medium text-[var(--text-primary)]">Include Loan EMI Deductions</span>
            </label>
            <p className="text-xs text-[var(--text-muted)] pl-6">
              Automatically deducts scheduled monthly installments from employee loan accounts.
            </p>
          </div>

          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--warning-light)] border border-[var(--warning)]/20 space-y-1">
            <div className="font-medium text-sm flex items-center gap-1.5 text-[var(--warning)]">
              <AlertCircle className="w-4 h-4" />
              <span>Attendance Verification</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Payable days, LOP, and Comp-Off credits are validated against the shared attendance engine.
            </p>
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={processing} className="btn-primary flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              {processing ? 'Calculating...' : 'Start Payroll Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
