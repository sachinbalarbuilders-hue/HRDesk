import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import {
  Calendar,
  Upload,
  CheckCircle2,
  FileText,
  X,
} from 'lucide-react';

interface InitiateExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedEmployee?: {
    employeeId: number;
    employeeName: string;
    noticePeriodDays?: number;
  } | null;
}

export const InitiateExitModal: React.FC<InitiateExitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedEmployee,
}) => {
  const { showSuccess, showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [form, setForm] = useState({
    employeeId: 0,
    exitType: 'Resignation',
    resignationDate: new Date().toISOString().split('T')[0],
    lastWorkingDate: new Date().toISOString().split('T')[0],
    noticePeriodDays: 30,
    reason: 'Career Growth & Opportunity',
    reasonDetails: '',
    isEligibleForRehire: true,
    documentBase64: '',
    documentFileName: '',
    documentContentType: 'application/pdf',
  });

  const REASONS = [
    'Career Growth & Opportunity',
    'Higher Compensation / Better Offer',
    'Relocation / Personal Reasons',
    'Health / Medical Reasons',
    'Pursuing Higher Education',
    'Work Environment / Culture',
    'Performance / Involuntary Termination',
    'Misconduct / Disciplinary Action',
    'Contract / Project Completion',
    'Retirement',
    'Other',
  ];

  // Fetch active employees for selection dropdown
  useEffect(() => {
    if (!isOpen) return;
    if (preselectedEmployee) {
      const noticeDays = preselectedEmployee.noticePeriodDays || 30;
      const resDate = new Date();
      const lwd = new Date(resDate);
      lwd.setDate(lwd.getDate() + noticeDays);

      setForm((prev) => ({
        ...prev,
        employeeId: preselectedEmployee.employeeId,
        noticePeriodDays: noticeDays,
        resignationDate: resDate.toISOString().split('T')[0],
        lastWorkingDate: lwd.toISOString().split('T')[0],
      }));
    } else {
      const fetchEmployees = async () => {
        try {
          setLoadingEmployees(true);
          const res = await apiClient.get('/employees', {
            params: { status: 'active', pageSize: 200 },
          });
          setEmployees(res.data?.items || []);
        } catch {
          showError('Failed to load employees', 'Unable to retrieve employee list.');
        } finally {
          setLoadingEmployees(false);
        }
      };
      fetchEmployees();
    }
  }, [isOpen, preselectedEmployee, showError]);

  // Recalculate LWD when Resignation Date or Notice Days change
  const handleResignationDateChange = (dateStr: string) => {
    const resDate = new Date(dateStr);
    if (!isNaN(resDate.getTime())) {
      const lwd = new Date(resDate);
      lwd.setDate(lwd.getDate() + form.noticePeriodDays);
      setForm((prev) => ({
        ...prev,
        resignationDate: dateStr,
        lastWorkingDate: lwd.toISOString().split('T')[0],
      }));
    } else {
      setForm((prev) => ({ ...prev, resignationDate: dateStr }));
    }
  };

  const handleNoticeDaysChange = (days: number) => {
    const resDate = new Date(form.resignationDate);
    if (!isNaN(resDate.getTime())) {
      const lwd = new Date(resDate);
      lwd.setDate(lwd.getDate() + days);
      setForm((prev) => ({
        ...prev,
        noticePeriodDays: days,
        lastWorkingDate: lwd.toISOString().split('T')[0],
      }));
    } else {
      setForm((prev) => ({ ...prev, noticePeriodDays: days }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Document must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setForm((prev) => ({
        ...prev,
        documentBase64: base64,
        documentFileName: file.name,
        documentContentType: file.type || 'application/pdf',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      showError('Required', 'Please select an employee.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.post('/employee-exits/initiate', form);
      showSuccess('Exit Initiated', res.data?.message || 'Exit request submitted successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      showError('Failed to Initiate Exit', err?.response?.data?.message || 'Server error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        form.exitType === 'Termination'
          ? 'Initiate Employee Termination'
          : 'Initiate Resignation / Exit'
      }
      description="Record notice details and initialize offboarding workflow."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Row 1: Employee & Exit Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Employee <span className="text-[var(--err-500)]">*</span>
            </label>
            {preselectedEmployee ? (
              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] border border-[var(--rule)] text-xs font-bold text-[var(--ink)]">
                {preselectedEmployee.employeeName} (EMP#{preselectedEmployee.employeeId})
              </div>
            ) : (
              <select
                value={form.employeeId}
                onChange={(e) => {
                  const empId = Number(e.target.value);
                  const found = employees.find((emp) => emp.employeeId === empId);
                  const noticeDays = found?.noticePeriodDays || 30;
                  setForm((prev) => ({
                    ...prev,
                    employeeId: empId,
                    noticePeriodDays: noticeDays,
                  }));
                  handleNoticeDaysChange(noticeDays);
                }}
                className="register-input w-full"
                required
                disabled={loadingEmployees}
              >
                <option value={0}>Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.employeeName} — EMP#{emp.employeeId} ({emp.department || 'No Dept'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Exit Type <span className="text-[var(--err-500)]">*</span>
            </label>
            <select
              value={form.exitType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  exitType: e.target.value,
                  isEligibleForRehire: e.target.value !== 'Termination',
                }))
              }
              className="register-input w-full"
              required
            >
              <option value="Resignation">Resignation (Employee Notice)</option>
              <option value="Termination">Termination (Employer Action)</option>
              <option value="ContractEnd">Contract Expiry</option>
              <option value="Retirement">Retirement</option>
              <option value="Absconding">Absconding / Desertion</option>
            </select>
          </div>
        </div>

        {/* Row 2: Clean 3-Column Dates & Notice */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1 flex items-center gap-1">
              <Calendar size={12} className="text-[var(--gold-500)]" />
              <span>Notice Date</span>
            </label>
            <input
              type="date"
              value={form.resignationDate}
              onChange={(e) => handleResignationDateChange(e.target.value)}
              className="register-input w-full text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Notice Days
            </label>
            <input
              type="number"
              min={0}
              max={180}
              value={form.noticePeriodDays}
              onChange={(e) => handleNoticeDaysChange(Number(e.target.value))}
              className="register-input w-full text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1 flex items-center gap-1">
              <Calendar size={12} className="text-emerald-600" />
              <span>Last Working Day (LWD)</span>
            </label>
            <input
              type="date"
              value={form.lastWorkingDate}
              onChange={(e) => setForm((prev) => ({ ...prev, lastWorkingDate: e.target.value }))}
              className="register-input w-full text-xs font-bold text-emerald-600 dark:text-emerald-400"
              required
            />
          </div>
        </div>

        {/* Row 3: Reason & Admin Rehire Eligibility */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
              Primary Reason <span className="text-[var(--err-500)]">*</span>
            </label>
            <select
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              className="register-input w-full"
              required
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="rehireCheck"
              checked={form.isEligibleForRehire}
              onChange={(e) => setForm((prev) => ({ ...prev, isEligibleForRehire: e.target.checked }))}
              className="w-4 h-4 rounded text-[var(--gold-500)] border-[var(--rule)] focus:ring-[var(--gold-500)] cursor-pointer"
            />
            <label htmlFor="rehireCheck" className="text-xs font-medium text-[var(--ink)] cursor-pointer select-none">
              Eligible for rehire in future
            </label>
          </div>
        </div>

        {/* Row 4: Remarks / Notes */}
        <div>
          <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
            Detailed Reason / Remarks
          </label>
          <textarea
            rows={2}
            value={form.reasonDetails}
            onChange={(e) => setForm((prev) => ({ ...prev, reasonDetails: e.target.value }))}
            placeholder="Add handover instructions, discussion notes, or reason details..."
            className="register-input w-full resize-none text-xs"
          />
        </div>

        {/* Row 5: Clean Inline Document Attachment */}
        <div className="pt-1">
          <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">
            Attach Resignation / Notice Letter (Optional)
          </label>
          <div className="flex items-center gap-3">
            <label className="btn-outline text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5 border-[var(--rule)] hover:border-[var(--gold-500)] text-[var(--ink)]">
              <Upload size={13} className="text-[var(--gold-500)]" />
              <span>Choose Document</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {form.documentFileName ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 size={13} />
                <span className="truncate max-w-[200px]">{form.documentFileName}</span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, documentBase64: '', documentFileName: '' }))}
                  className="text-[var(--err-500)] hover:text-[var(--err-600)] p-0.5 ml-1 cursor-pointer"
                  title="Remove file"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--ink-muted)]">PDF, Word, or Image (max 5MB)</span>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--rule)]">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline text-xs py-1.5 px-4 cursor-pointer"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary text-xs py-1.5 px-4 cursor-pointer"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Exit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
