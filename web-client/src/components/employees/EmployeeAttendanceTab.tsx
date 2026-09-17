import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Loader2, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface EmployeeAttendanceTabProps {
  employeeId: number;
}

export const EmployeeAttendanceTab: React.FC<EmployeeAttendanceTabProps> = ({ employeeId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<any>(null);
  
  // Use current month/year by default
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await apiClient.get(`/attendance/summary/${employeeId}?year=${year}&month=${month}`);
        setSummary(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch attendance summary');
      } finally {
        setLoading(false);
      }
    };
    if (employeeId) {
      fetchSummary();
    }
  }, [employeeId, month, year]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)] text-sm">
          <Calendar size={14} className="text-[var(--accent)]" />
          <span>Monthly Summary</span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={month} 
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="register-input text-xs py-1 px-2 h-7"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'short' })}
              </option>
            ))}
          </select>
          <select 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="register-input text-xs py-1 px-2 h-7"
          >
            {Array.from({ length: 5 }).map((_, i) => {
              const y = new Date().getFullYear() - 2 + i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-6 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface-secondary)]">
          <Loader2 className="animate-spin text-[var(--text-secondary)]" size={24} />
        </div>
      ) : error ? (
        <div className="p-4 border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] rounded-[var(--radius-sm)] text-sm font-normal">
          {error}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 text-sm font-normal">
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] flex items-center gap-1.5"><CheckCircle size={12}/> Present Days</span>
            <p className="font-semibold text-[var(--text-primary)] mt-1 text-base">{summary.presentCount}</p>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] flex items-center gap-1.5"><XCircle size={12}/> Absent Days</span>
            <p className="font-semibold text-[var(--danger)] mt-1 text-base">{summary.absentCount}</p>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] flex items-center gap-1.5"><Clock size={12}/> Half Days</span>
            <p className="font-semibold text-[var(--text-primary)] mt-1 text-base">{summary.halfDayCount}</p>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] flex items-center gap-1.5"><Calendar size={12}/> Paid Leaves</span>
            <p className="font-semibold text-[var(--text-primary)] mt-1 text-base">{summary.leaveCount}</p>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-xs uppercase font-semibold text-[var(--text-secondary)]">Weekoffs / Holidays</span>
            <p className="font-semibold text-[var(--text-primary)] mt-1 text-base">{summary.weekoffCount + summary.holidayCount}</p>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="text-xs uppercase font-semibold text-[var(--text-secondary)]">Unpaid Leaves</span>
            <p className="font-semibold text-[var(--text-primary)] mt-1 text-base">{summary.unpaidLeaveCount}</p>
          </div>
          <div className="col-span-2 p-3 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 border border-[var(--accent)]">
            <span className="text-xs uppercase font-semibold text-[var(--accent)] flex items-center gap-1.5"><AlertCircle size={12}/> Total Payable Days</span>
            <p className="font-semibold text-[var(--accent)] mt-1 text-base">{summary.payableDays}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
