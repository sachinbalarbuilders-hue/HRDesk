import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';

interface PaymentItem {
  id: number;
  invoiceNumber: string;
  organizationName: string;
  planName: string;
  amount: number;
  taxAmount: number;
  total: number;
  currency: string;
  billingCycle: string;
  status: string;
  paidAt?: string;
  createdAt: string;
}

export const BillingTab: React.FC = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/superadmin/payments', { params: { page, pageSize } });
      setPayments(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalCount(res.data.totalCount || 0);
    } catch {
      console.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [page]);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'Paid': return 'success';
      case 'Pending': return 'warning';
      case 'Failed': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Global Billing & Invoices</h3>
          <p className="text-[11px] text-[var(--text-muted)]">All payment transactions across tenants.</p>
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">{totalCount} total records</span>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-secondary)] border-b border-[var(--border)]">
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Billing</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center"><Loader2 size={16} className="animate-spin inline text-[var(--accent)]" /></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-[var(--text-muted)]">No payments recorded.</td></tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                  <td className="py-3 px-4 font-mono font-semibold text-[var(--text-primary)]">{p.invoiceNumber}</td>
                  <td className="py-3 px-4 text-[var(--text-primary)]">{p.organizationName}</td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">{p.planName}</td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">{p.billingCycle}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-muted)]">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-data text-right">₹{p.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 font-data text-right text-[var(--text-muted)]">₹{p.taxAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 font-data font-semibold text-right text-[var(--text-primary)]">₹{p.total.toLocaleString()}</td>
                  <td className="py-3 px-4"><Badge variant={statusVariant(p.status) as any} dot>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]">
            <span className="text-[11px] text-[var(--text-muted)]">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-[var(--radius-md)] border border-[var(--border)] disabled:opacity-30 cursor-pointer hover:bg-[var(--surface)]">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-[var(--text-primary)] font-medium">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-[var(--radius-md)] border border-[var(--border)] disabled:opacity-30 cursor-pointer hover:bg-[var(--surface)]">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
