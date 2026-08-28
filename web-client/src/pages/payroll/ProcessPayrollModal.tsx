import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';
import {
  X, ChevronRight, ChevronLeft, Calculator, AlertTriangle,
  CheckCircle2, Loader2, Search,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedMonth: string;
  onDone: () => void;
  departments: { id: number; name: string }[];
}

type Cycle = 'Monthly' | 'Semi-Monthly' | 'Weekly';
type Step = 1 | 2 | 3;

interface SimpleEmp { employeeId: number; employeeName: string; department?: string; }

interface EmpPreview {
  employeeId: number;
  employeeName: string;
  department?: string;
  payGroupName?: string;
  annualCTC?: number;
  alreadyProcessed: boolean;
  isLocked: boolean;
  existingStatus?: string;
  warnings: string[];
  canProcess: boolean;
}

interface PreviewResult {
  month: string;
  total: number;
  canProcess: number;
  withWarnings: number;
  employees: EmpPreview[];
}

const CYCLES: { id: Cycle; label: string; desc: string }[] = [
  { id: 'Monthly',      label: 'Monthly',      desc: 'Full calendar month — most common' },
  { id: 'Semi-Monthly', label: 'Semi-Monthly', desc: '1st–15th and 16th–end of month' },
  { id: 'Weekly',       label: 'Weekly',       desc: 'Every 7 days' },
];

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const ProcessPayrollModal: React.FC<Props> = ({
  open, onClose, selectedMonth, onDone, departments,
}) => {
  const [step, setStep]             = useState<Step>(1);
  const [cycle, setCycle]           = useState<Cycle>('Monthly');
  const [month, setMonth]           = useState(selectedMonth);
  const [departmentId, setDepartmentId] = useState('');
  const [skipLoans, setSkipLoans]   = useState(false);

  // Employee selection
  const [allEmployees, setAllEmployees]     = useState<SimpleEmp[]>([]);
  const [loadingEmps, setLoadingEmps]       = useState(false);
  const [empSearch, setEmpSearch]           = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<number>>(new Set());

  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview]           = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processing, setProcessing]         = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setMonth(selectedMonth);
      setDepartmentId('');
      setSkipLoans(false);
      setPreview(null);
      setEmpSearch('');
      setSelectedEmpIds(new Set());
    }
  }, [open, selectedMonth]);

  // Load employees when dept changes
  const loadEmployees = useCallback(async (deptId: string) => {
    try {
      setLoadingEmps(true);
      const params: any = { status: 'active', pageSize: 500 };
      if (deptId) params.departmentId = deptId;
      const res = await apiClient.get('/employees', { params });
      const items: SimpleEmp[] = (res.data?.items || []).map((e: any) => ({
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        department: e.department,
      }));
      setAllEmployees(items);
      // Select all by default
      setSelectedEmpIds(new Set(items.map(e => e.employeeId)));
    } catch { /* silent */ }
    finally { setLoadingEmps(false); }
  }, []);

  useEffect(() => {
    if (open) loadEmployees(departmentId);
  }, [open, departmentId]);

  if (!open) return null;

  const filteredEmps = empSearch
    ? allEmployees.filter(e => e.employeeName.toLowerCase().includes(empSearch.toLowerCase()))
    : allEmployees;

  const allSelected = filteredEmps.length > 0 && filteredEmps.every(e => selectedEmpIds.has(e.employeeId));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedEmpIds(s => { const n = new Set(s); filteredEmps.forEach(e => n.delete(e.employeeId)); return n; });
    } else {
      setSelectedEmpIds(s => { const n = new Set(s); filteredEmps.forEach(e => n.add(e.employeeId)); return n; });
    }
  };
  const toggleEmp = (id: number) =>
    setSelectedEmpIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setPreviewError(null);
      const params: any = { month };
      if (departmentId) params.departmentId = departmentId;
      if (selectedEmpIds.size > 0 && selectedEmpIds.size < allEmployees.length) {
        params.employeeIds = Array.from(selectedEmpIds).join(',');
      }
      const res = await apiClient.get('/payroll/preview-run', { params });
      // Filter preview to only selected employees
      const filtered = {
        ...res.data,
        employees: (res.data.employees as EmpPreview[]).filter(e => selectedEmpIds.has(e.employeeId)),
      };
      filtered.total        = filtered.employees.length;
      filtered.canProcess   = filtered.employees.filter((e: EmpPreview) => e.canProcess).length;
      filtered.withWarnings = filtered.employees.filter((e: EmpPreview) => e.warnings.length > 0).length;
      setPreview(filtered);
      setStep(2);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Unknown error';
      setPreviewError(`Error ${status}: ${msg}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProcess = async () => {
    if (!preview) return;
    const eligibleIds = preview.employees.filter(e => e.canProcess).map(e => e.employeeId);
    if (eligibleIds.length === 0) return;
    try {
      setProcessing(true);
      const res = await apiClient.post('/payroll/process', {
        month,
        employeeIds: eligibleIds,
        skipLoans,
      });
      setProcessedCount(res.data.processedCount || eligibleIds.length);
      setStep(3);
    } catch { /* silent */ }
    finally { setProcessing(false); }
  };

  const eligible = preview?.employees.filter(e => e.canProcess) ?? [];
  const skipped  = preview?.employees.filter(e => !e.canProcess) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div className="w-full max-w-[540px] bg-[var(--surface)] h-full shadow-2xl flex flex-col border-l border-[var(--border)]">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Run Payroll</h3>
            <div className="flex items-center gap-2 mt-1.5">
              {(['Configure', 'Review', 'Done'] as const).map((label, i) => {
                const s = i + 1;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      step > s ? 'bg-[var(--success)] text-white' :
                      step === s ? 'bg-[var(--accent)] text-white' :
                      'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                    }`}>
                      {step > s ? '✓' : s}
                    </div>
                    <span className={`text-[11px] ${step === s ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                      {label}
                    </span>
                    {s < 3 && <div className={`w-6 h-px ml-1 ${step > s ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)]">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Step 1 */}
          {step === 1 && (
            <>
              {/* Pay Cycle */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Pay Cycle</p>
                <div className="grid grid-cols-3 gap-2">
                  {CYCLES.map(c => (
                    <label key={c.id} className={`flex flex-col gap-0.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      cycle === c.id
                        ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}>
                      <input type="radio" name="cycle" value={c.id}
                        checked={cycle === c.id} onChange={() => setCycle(c.id)}
                        className="sr-only"
                      />
                      <span className="text-sm font-bold text-[var(--text-primary)]">{c.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{c.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Month */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Month *</p>
                <input type="month" value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="register-input w-full"
                />
              </div>

              {/* Department filter */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                  Department <span className="normal-case font-normal">(optional)</span>
                </p>
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  className="register-input w-full">
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Employee selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Employees
                    <span className="ml-1.5 normal-case font-normal text-[var(--text-muted)]">
                      ({selectedEmpIds.size} of {allEmployees.length} selected)
                    </span>
                  </p>
                  <button onClick={toggleAll} className="text-[11px] text-[var(--accent)] hover:underline font-medium">
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {/* Search within employees */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    placeholder="Filter employees..."
                    className="register-input w-full text-sm"
                    style={{ paddingLeft: '2.1rem' }}
                  />
                </div>

                {/* Employee list */}
                <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-52 overflow-y-auto divide-y divide-[var(--border)]">
                  {loadingEmps ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-[var(--text-muted)] text-sm">
                      <Loader2 size={16} className="animate-spin" /> Loading...
                    </div>
                  ) : filteredEmps.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[var(--text-muted)]">No employees found</div>
                  ) : filteredEmps.map(emp => (
                    <label key={emp.employeeId}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors ${
                        selectedEmpIds.has(emp.employeeId) ? 'bg-[var(--accent-light)]' : ''
                      }`}
                    >
                      <input type="checkbox"
                        checked={selectedEmpIds.has(emp.employeeId)}
                        onChange={() => toggleEmp(emp.employeeId)}
                        className="accent-[var(--accent)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{emp.employeeName}</div>
                        {emp.department && <div className="text-[11px] text-[var(--text-muted)]">{emp.department}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="p-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={!skipLoans}
                    onChange={e => setSkipLoans(!e.target.checked)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">Include Loan EMI Deductions</div>
                    <div className="text-xs text-[var(--text-muted)]">Auto-deduct scheduled installments for the month</div>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Step 2 — Review */}
          {step === 2 && preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Selected',      value: preview.total,        color: 'text-[var(--text-primary)]' },
                  { label: 'Will Process',  value: preview.canProcess,   color: 'text-[var(--success)]' },
                  { label: 'With Warnings', value: preview.withWarnings, color: 'text-[var(--warning)]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 bg-[var(--surface-secondary)] rounded-lg text-center border border-[var(--border)]">
                    <div className={`text-2xl font-bold font-data ${color}`}>{value}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Employee Breakdown</p>
                <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)]">
                  {preview.employees.map(emp => (
                    <div key={emp.employeeId}
                      className={`flex items-start gap-3 px-3 py-2.5 ${emp.isLocked ? 'opacity-40' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        emp.canProcess
                          ? 'bg-[var(--success-light)] text-[var(--success)]'
                          : 'bg-[var(--danger-light)] text-[var(--danger)]'
                      }`}>
                        {emp.canProcess ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{emp.employeeName}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {[emp.department, emp.payGroupName, emp.annualCTC ? `${fmt(emp.annualCTC)}/yr` : null]
                            .filter(Boolean).join(' · ')}
                        </div>
                        {emp.warnings.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {emp.warnings.map(w => (
                              <span key={w} className="text-[10px] bg-[var(--warning-light)] text-[var(--warning)] px-1.5 py-0.5 rounded-[3px] font-medium">{w}</span>
                            ))}
                          </div>
                        )}
                        {emp.alreadyProcessed && !emp.isLocked && (
                          <span className="text-[10px] text-[var(--info)] bg-[var(--info-light)] px-1.5 py-0.5 rounded-[3px] font-medium mt-1 inline-block">
                            Will re-process ({emp.existingStatus})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {skipped.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    {skipped.length} employee{skipped.length !== 1 ? 's' : ''} will be skipped — see warnings above.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--success-light)] flex items-center justify-center">
                <CheckCircle2 size={32} className="text-[var(--success)]" />
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">Payroll Processed</div>
                <div className="text-sm text-[var(--text-muted)] mt-1">
                  Processed <span className="font-semibold text-[var(--success)]">{processedCount}</span> employee{processedCount !== 1 ? 's' : ''} for {month}
                </div>
              </div>
              <button onClick={() => { onDone(); onClose(); }} className="btn-primary mt-2">
                View Payroll Register
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {step < 3 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] shrink-0">
            <button
              onClick={() => step === 1 ? onClose() : setStep(s => (s - 1) as Step)}
              className="btn-outline flex items-center gap-1.5 text-sm"
            >
              {step === 1 ? <><X size={14} /> Cancel</> : <><ChevronLeft size={14} /> Back</>}
            </button>

            {step === 1 && (
              <>
                {previewError && (
                  <p className="text-xs text-[var(--danger)] bg-[var(--danger-light)] px-3 py-2 rounded-lg">{previewError}</p>
                )}
                <button onClick={loadPreview}
                  disabled={loadingPreview || !month || selectedEmpIds.size === 0}
                  className="btn-primary flex items-center gap-1.5 text-sm"
                >
                  {loadingPreview
                    ? <><Loader2 size={14} className="animate-spin" /> Loading...</>
                    : <>Review {selectedEmpIds.size} Employee{selectedEmpIds.size !== 1 ? 's' : ''} <ChevronRight size={14} /></>}
                </button>
              </>
            )}

            {step === 2 && (
              <button onClick={handleProcess}
                disabled={processing || eligible.length === 0}
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                {processing
                  ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  : <><Calculator size={14} /> Process {eligible.length} Employee{eligible.length !== 1 ? 's' : ''}</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
