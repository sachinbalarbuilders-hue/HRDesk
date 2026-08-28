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
        <div className="flex items-center gap-2 font-semibold text-[var(--ink)] text-xs">
          <Calendar size={14} className="text-[var(--gold-500)]" />
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
        <div className="flex justify-center p-6 border border-[var(--rule)] rounded-[4px] bg-[var(--paper)]">
          <Loader2 className="animate-spin text-[var(--ink-muted)]" size={24} />
        </div>
      ) : error ? (
        <div className="p-4 border border-[var(--gold-300)] bg-[var(--gold-50)] text-[var(--gold-700)] rounded-[4px] text-xs">
          {error}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui flex items-center gap-1.5"><CheckCircle size={12}/> Present Days</span>
            <p className="font-data font-semibold text-[var(--ink)] mt-1 text-lg">{summary.presentCount}</p>
          </div>
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui flex items-center gap-1.5"><XCircle size={12}/> Absent Days</span>
            <p className="font-data font-semibold text-[var(--red-600)] mt-1 text-lg">{summary.absentCount}</p>
          </div>
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui flex items-center gap-1.5"><Clock size={12}/> Half Days</span>
            <p className="font-data font-semibold text-[var(--ink)] mt-1 text-lg">{summary.halfDayCount}</p>
          </div>
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui flex items-center gap-1.5"><Calendar size={12}/> Paid Leaves</span>
            <p className="font-data font-semibold text-[var(--ink)] mt-1 text-lg">{summary.leaveCount}</p>
          </div>
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Weekoffs / Holidays</span>
            <p className="font-data font-semibold text-[var(--ink)] mt-1 text-lg">{summary.weekoffCount + summary.holidayCount}</p>
          </div>
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Unpaid Leaves</span>
            <p className="font-data font-semibold text-[var(--ink)] mt-1 text-lg">{summary.unpaidLeaveCount}</p>
          </div>
          <div className="col-span-2 p-3 rounded-[4px] bg-[var(--gold-50)] border border-[var(--gold-300)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--gold-700)] font-ui flex items-center gap-1.5"><AlertCircle size={12}/> Total Payable Days</span>
            <p className="font-data font-semibold text-[var(--gold-700)] mt-1 text-xl">{summary.payableDays}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
