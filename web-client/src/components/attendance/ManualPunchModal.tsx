import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { TimeInput } from '../ui/TimeInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../api/client';
import { Loader2 } from 'lucide-react';

interface ManualPunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId?: number | string;
}

export const ManualPunchModal: React.FC<ManualPunchModalProps> = ({ isOpen, onClose, onSuccess, branchId }) => {
  const { showSuccess, showError } = useToast();

  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [allEmployees, setAllEmployees] = useState<{ value: string; label: string; deptId: string; deptName?: string }[]>([]);
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load eligible employees scoped strictly to Attendance.Create permission
    apiClient.get('/attendance/eligible-employees', { params: { branchId: branchId || undefined } })
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        const mapped = list.map((e: any) => ({
          value: String(e.employeeId),
          label: `${e.employeeName} (EMP#${String(e.employeeId).padStart(3, '0')})`,
          deptId: String(e.departmentId ?? ''),
          deptName: e.departmentName || '',
        }));
        setAllEmployees(mapped);

        // Derive available departments strictly from the scoped eligible employees
        const deptMap = new Map<string, string>();
        mapped.forEach((e: any) => {
          if (e.deptId && e.deptName) {
            deptMap.set(e.deptId, e.deptName);
          }
        });

        if (deptMap.size > 0) {
          const scopedDepts = Array.from(deptMap.entries()).map(([value, label]) => ({ value, label }));
          setDepartments(scopedDepts);
          if (scopedDepts.length === 1) {
            setDepartmentId(scopedDepts[0].value);
          }
        } else {
          setDepartments([]);
        }

        if (mapped.length === 1) {
          setEmployeeId(mapped[0].value);
        }
      })
      .catch(err => {
        console.error('Failed to load eligible employees', err);
        // Fallback: load via /employees with scopeKey=Attendance.Create
        apiClient.get('/employees', { params: { pageSize: 1000, scopeKey: 'Attendance.Create', branchId: branchId || undefined } })
          .then(res => {
            const list = res.data?.items || (Array.isArray(res.data) ? res.data : []);
            const mapped = list.map((e: any) => ({
              value: String(e.employeeId),
              label: `${e.employeeName} (EMP#${String(e.employeeId).padStart(3, '0')})`,
              deptId: String(e.departmentId ?? e.department?.id ?? e.deptId ?? ''),
              deptName: e.departmentName || e.department?.name || '',
            }));
            setAllEmployees(mapped);
          })
          .catch(e => console.error('Fallback failed', e));
      });
  }, [isOpen, branchId]);

  // Filter employees when department changes
  useEffect(() => {
    if (!departmentId) {
      setEmployees(allEmployees.map(({ value, label }) => ({ value, label })));
    } else {
      setEmployees(
        allEmployees
          .filter(e => e.deptId === departmentId)
          .map(({ value, label }) => ({ value, label }))
      );
    }
    setEmployeeId(prev => {
      if (!prev) return '';
      const inList = allEmployees.some(e => e.value === prev && (!departmentId || e.deptId === departmentId));
      return inList ? prev : '';
    });
  }, [departmentId, allEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }
    if (!date) {
      showError('Validation Error', 'Please select a date.');
      return;
    }
    if (!inTime && !outTime) {
      showError('Validation Error', 'Please provide at least In Time or Out Time.');
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.post('/attendance/manual-punch', {
        employeeId: parseInt(employeeId),
        punchDate: date,
        inTime: inTime || null,
        outTime: outTime || null,
        reason,
      });

      showSuccess('Attendance Added', 'Attendance record was saved successfully.');
      onSuccess();
      handleClose();
    } catch (error: any) {
      showError('Save Failed', error.response?.data?.message || 'Could not save attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDepartmentId('');
    setEmployeeId('');
    setDate(new Date().toISOString().split('T')[0]);
    setInTime('');
    setOutTime('');
    setReason('');
    onClose();
  };


  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Attendance">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Row 1: Department + Employee */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">Department</label>
            <SearchableSelect
              options={[{ value: '', label: 'All Departments' }, ...departments]}
              value={departmentId}
              onChange={setDepartmentId}
              placeholder="All Departments"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Employee <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={employees}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Select Employee..."
            />
          </div>
        </div>

        {/* Row 2: Date + In Time + Out Time */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
          <TimeInput label="In Time" value={inTime} onChange={setInTime} />
          <TimeInput label="Out Time" value={outTime} onChange={setOutTime} />
        </div>

        {/* Row 3: Reason */}
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1">Reason / Remarks</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="E.g., Forgot ID card, biometric machine down..."
            className="w-full px-3 py-2 bg-[var(--paper)] border border-[var(--rule)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-[var(--ink)] text-sm resize-none"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--rule)]">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-[var(--ink)] bg-[var(--paper-subtle)] border border-[var(--rule)] rounded-md hover:brightness-95 transition-all"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center min-w-[120px] px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-md shadow-xs hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save Attendance'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
