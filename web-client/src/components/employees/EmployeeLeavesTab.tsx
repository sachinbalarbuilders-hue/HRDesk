import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Loader2, CalendarCheck2 } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface Allocation {
  leaveTypeId: number;
  code: string;
  name: string;
  isPaid: boolean;
  allocated: number;
  openingBalance: number;
  used: number;
  remaining: number;
  textColor?: string;
  backgroundColor?: string;
}

interface LeaveHistoryItem {
  id: number;
  applicationNumber?: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  dayType: string;
  reason?: string;
  status: string;
}

interface EmployeeLeavesTabProps {
  employeeId: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatDays = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const statusClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'bg-emerald-500/10 text-emerald-600';
  if (s === 'rejected' || s === 'cancelled') return 'bg-[var(--danger)]/10 text-[var(--danger)]';
  if (s === 'adjusted') return 'bg-[var(--accent)]/10 text-[var(--accent)]';
  return 'bg-[var(--warning)]/10 text-[var(--warning)]';
};

export const EmployeeLeavesTab: React.FC<EmployeeLeavesTabProps> = ({ employeeId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [yearStartMonth, setYearStartMonth] = useState(11);
  const [yearEndMonth, setYearEndMonth] = useState(10);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [history, setHistory] = useState<LeaveHistoryItem[]>([]);

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await apiClient.get(`/employees/${employeeId}/leaves`);
        setYear(res.data.year);
        setYearStartMonth(res.data.yearStartMonth ?? 11);
        setYearEndMonth(res.data.yearEndMonth ?? 10);
        setAllocations(res.data.allocations || []);
        setHistory(res.data.history || []);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load leave allocations');
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) fetchLeaves();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex justify-center p-6 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface-secondary)]">
        <Loader2 className="animate-spin text-[var(--text-secondary)]" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] rounded-[var(--radius-sm)] text-sm font-normal">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)] text-sm">
          <CalendarCheck2 size={14} className="text-[var(--accent)]" />
          <span>Allocated Leaves</span>
        </div>
        {year != null && (
          <span className="text-xs uppercase font-semibold tracking-wide text-[var(--text-secondary)]">
            {MONTHS[yearStartMonth - 1]} {year} – {MONTHS[yearEndMonth - 1]} {yearStartMonth === 1 ? year : year + 1}
          </span>
        )}
      </div>

      {allocations.length === 0 ? (
        <div className="p-6 text-center text-sm font-normal text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface-secondary)]">
          No leave allocations found for the current company year.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allocations.map((alloc) => (
            <div
              key={alloc.leaveTypeId}
              className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">{alloc.name}</p>
                  <p className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">
                    {alloc.isPaid ? 'Paid' : 'Unpaid'}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)]"
                  style={
                    alloc.backgroundColor && alloc.backgroundColor !== 'transparent'
                      ? { backgroundColor: alloc.backgroundColor, color: alloc.textColor || undefined }
                      : undefined
                  }
                >
                  {alloc.code}
                </span>
              </div>
              <p className="text-base font-semibold text-[var(--text-primary)] leading-none">
                {formatDays(alloc.remaining)}
                <span className="text-xs font-normal text-[var(--text-secondary)] ml-1.5">left</span>
              </p>
              <p className="text-xs font-normal text-[var(--text-secondary)] mt-2">
                Total: <span className="font-semibold text-[var(--text-primary)]">{formatDays(alloc.allocated + alloc.openingBalance)}</span>
                {' '}| Used: <span className="font-semibold text-[var(--text-primary)]">{formatDays(alloc.used)}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Leave History</h4>
        <div className="border border-[var(--border)] rounded-[var(--radius-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-normal">
              <thead className="bg-[var(--surface-secondary)] text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <tr>
                  <th className="text-center font-semibold px-3 py-2 w-12">Sr.</th>
                  <th className="text-left font-semibold px-3 py-2">Dates</th>
                  <th className="text-left font-semibold px-3 py-2">Type</th>
                  <th className="text-right font-semibold px-3 py-2">Days</th>
                  <th className="text-left font-semibold px-3 py-2">Reason</th>
                  <th className="text-left font-semibold px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[var(--text-secondary)] text-sm">
                      No leave applications found.
                    </td>
                  </tr>
                ) : (
                  history.map((row, idx) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 text-center  text-xs text-[var(--text-secondary)] w-12">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">
                        {formatDate(row.startDate)}
                        {row.startDate !== row.endDate ? ` – ${formatDate(row.endDate)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-primary)]">
                        {row.leaveTypeName}
                        {row.leaveTypeCode ? <span className="text-[var(--text-secondary)]  ml-1">({row.leaveTypeCode})</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--text-primary)] whitespace-nowrap">
                        {formatDays(row.totalDays)}
                        {row.dayType && row.dayType !== 'Full Day' ? (
                          <span className="block text-xs font-normal text-[var(--text-secondary)]">{row.dayType}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[220px] truncate" title={row.reason || ''}>
                        {row.reason || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${statusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
