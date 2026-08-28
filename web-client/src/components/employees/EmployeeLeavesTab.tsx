import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Loader2, CalendarCheck2 } from 'lucide-react';

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

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatDays = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const statusClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'bg-[var(--ok-600)]/10 text-[var(--ok-600)]';
  if (s === 'rejected' || s === 'cancelled') return 'bg-[var(--err-600)]/10 text-[var(--err-600)]';
  if (s === 'adjusted') return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300';
  return 'bg-[var(--warn-600)]/10 text-[var(--warn-600)]';
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
      <div className="flex justify-center p-6 border border-[var(--rule)] rounded-[4px] bg-[var(--paper)]">
        <Loader2 className="animate-spin text-[var(--ink-muted)]" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-[var(--gold-300)] bg-[var(--gold-50)] text-[var(--gold-700)] rounded-[4px] text-xs">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-[var(--ink)] text-xs">
          <CalendarCheck2 size={14} className="text-[var(--gold-500)]" />
          <span>Allocated Leaves</span>
        </div>
        {year != null && (
          <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--ink-muted)] font-ui">
            {MONTHS[yearStartMonth - 1]} {year} – {MONTHS[yearEndMonth - 1]} {yearStartMonth === 1 ? year : year + 1}
          </span>
        )}
      </div>

      {allocations.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--ink-muted)] border border-dashed border-[var(--rule)] rounded-[4px] bg-[var(--paper)]">
          No leave allocations found for the current company year.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allocations.map((alloc) => (
            <div
              key={alloc.leaveTypeId}
              className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-[var(--ink)]">{alloc.name}</p>
                  <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                    {alloc.isPaid ? 'Paid' : 'Unpaid'}
                  </p>
                </div>
                <span
                  className="text-[10px] font-data font-semibold px-1.5 py-0.5 rounded border border-[var(--rule)] bg-[var(--surface)]"
                  style={
                    alloc.backgroundColor && alloc.backgroundColor !== 'transparent'
                      ? { backgroundColor: alloc.backgroundColor, color: alloc.textColor || undefined }
                      : undefined
                  }
                >
                  {alloc.code}
                </span>
              </div>
              <p className="font-data text-2xl font-semibold text-[var(--ink)] leading-none">
                {formatDays(alloc.remaining)}
                <span className="text-xs font-ui font-normal text-[var(--ink-muted)] ml-1.5">left</span>
              </p>
              <p className="text-[10px] text-[var(--ink-muted)] mt-2 font-ui">
                Total: <span className="font-data text-[var(--ink)]">{formatDays(alloc.allocated + alloc.openingBalance)}</span>
                {' '}| Used: <span className="font-data text-[var(--ink)]">{formatDays(alloc.used)}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="font-semibold text-xs text-[var(--ink)] mb-3">Leave History</h4>
        <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--paper)] text-[10px] uppercase tracking-wide text-[var(--ink-muted)] font-ui">
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
                    <td colSpan={6} className="px-3 py-8 text-center text-[var(--ink-muted)]">
                      No leave applications found.
                    </td>
                  </tr>
                ) : (
                  history.map((row, idx) => (
                    <tr key={row.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--ink-muted)] w-12">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 font-data text-[var(--ink)] whitespace-nowrap">
                        {formatDate(row.startDate)}
                        {row.startDate !== row.endDate ? ` – ${formatDate(row.endDate)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-[var(--ink)]">
                        {row.leaveTypeName}
                        {row.leaveTypeCode ? <span className="text-[var(--ink-muted)] font-data ml-1">({row.leaveTypeCode})</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right font-data text-[var(--ink)] whitespace-nowrap">
                        {formatDays(row.totalDays)}
                        {row.dayType && row.dayType !== 'Full Day' ? (
                          <span className="block text-[10px] text-[var(--ink-muted)] font-ui">{row.dayType}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[var(--ink-muted)] max-w-[220px] truncate" title={row.reason || ''}>
                        {row.reason || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusClass(row.status)}`}>
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
