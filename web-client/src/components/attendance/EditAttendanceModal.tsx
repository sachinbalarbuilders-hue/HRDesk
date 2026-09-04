import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { TimeInput } from '../ui/TimeInput';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../api/client';
import { Loader2, Calendar, User, Building2 } from 'lucide-react';

interface EditAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId?: number;
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  date?: string; // YYYY-MM-DD
  initialInTime?: string;
  initialOutTime?: string;
  punchId1?: number;
  punchId2?: number;
}

export const EditAttendanceModal: React.FC<EditAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
  employeeName,
  employeeCode,
  departmentName,
  date,
  initialInTime,
  initialOutTime,
  punchId1,
  punchId2,
}) => {
  const { showSuccess, showError } = useToast();

  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInTime(initialInTime || '');
      setOutTime(initialOutTime || '');
      setReason('');
    }
  }, [isOpen, initialInTime, initialOutTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      showError('Validation Error', 'Employee ID is missing.');
      return;
    }
    if (!date) {
      showError('Validation Error', 'Date is missing.');
      return;
    }
    if (!inTime && !outTime) {
      showError('Validation Error', 'Please provide at least In Time or Out Time.');
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.put('/attendance/edit', {
        employeeId,
        date,
        inTime: inTime || null,
        outTime: outTime || null,
        reason: reason || 'Manual adjustment via Edit Attendance form',
        punchId1: punchId1 || null,
        punchId2: punchId2 || null
      });

      showSuccess('Attendance Updated', `Attendance for ${employeeName || 'employee'} has been updated.`);
      onSuccess();
      onClose();
    } catch (error: any) {
      showError('Update Failed', error.response?.data?.message || 'Could not update attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Attendance" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee & Record Info Banner */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-bold">
              <User size={15} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[var(--text-primary)] text-sm">{employeeName || 'Employee'}</span>
                {employeeCode && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {employeeCode}
                  </span>
                )}
              </div>
              {departmentName && (
                <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                  <Building2 size={11} />
                  <span>{departmentName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[var(--text-secondary)] font-mono text-xs bg-[var(--surface)] px-2.5 py-1 rounded-md border border-[var(--border)]">
            <Calendar size={12} className="text-[var(--accent)]" />
            <span>{date}</span>
          </div>
        </div>

        {/* Timings Row (Date + In Time + Out Time) */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Date"
            type="date"
            value={date || ''}
            disabled
            className="opacity-75 cursor-not-allowed bg-[var(--surface-secondary)]"
          />
          <TimeInput label="In Time" value={inTime} onChange={setInTime} />
          <TimeInput label="Out Time" value={outTime} onChange={setOutTime} />
        </div>

        {/* Reason / Remarks */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Reason / Remarks
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="E.g., Out punch missed on biometric, late punch regularized..."
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-[var(--text-primary)] text-sm resize-none"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-secondary)] border border-[var(--border)] rounded-md hover:brightness-95 transition-all cursor-pointer"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center min-w-[140px] px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-md shadow-xs hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Save Attendance'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
