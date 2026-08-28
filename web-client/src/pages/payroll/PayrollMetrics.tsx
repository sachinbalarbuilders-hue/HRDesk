import React from 'react';
import { DollarSign, CreditCard, TrendingDown, CheckCircle2 } from 'lucide-react';

interface Props {
  metrics: {
    totalGross?: number;
    totalNet?: number;
    totalDeductions?: number;
  };
  totalCount: number;
}

export const PayrollMetrics: React.FC<Props> = ({ metrics, totalCount }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--accent)]">
      <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
        <DollarSign className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Total Gross CTC</div>
        <div className="text-lg font-bold font-data text-[var(--ink)]">₹{(metrics.totalGross || 0).toLocaleString()}</div>
      </div>
    </div>

    <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--success)]">
      <div className="w-10 h-10 rounded-lg bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Net Disbursable</div>
        <div className="text-lg font-bold font-data text-[var(--success)]">₹{(metrics.totalNet || 0).toLocaleString()}</div>
      </div>
    </div>

    <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--danger)]">
      <div className="w-10 h-10 rounded-lg bg-[var(--danger-light)] text-[var(--danger)] flex items-center justify-center shrink-0">
        <TrendingDown className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Total Deductions</div>
        <div className="text-lg font-bold font-data text-[var(--danger)]">₹{(metrics.totalDeductions || 0).toLocaleString()}</div>
      </div>
    </div>

    <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--warning)]">
      <div className="w-10 h-10 rounded-lg bg-[var(--warning-light)] text-[var(--warning)] flex items-center justify-center shrink-0">
        <CreditCard className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Processed Roster</div>
        <div className="text-lg font-bold font-data text-[var(--ink)]">{totalCount} Employees</div>
      </div>
    </div>
  </div>
);
