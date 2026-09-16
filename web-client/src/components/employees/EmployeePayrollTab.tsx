import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { IndianRupee, Plus, Landmark, FileText } from 'lucide-react';
import { TaxDeclarationModal } from '../payroll/TaxDeclarationModal';
import { Form16Modal } from '../payroll/Form16Modal';
import { AssignCTCModal } from '../../pages/settings/AssignCTCModal';

interface CTCRecord {
  id: number;
  annualCTC: number;
  monthlyCTC: number;
  payGroupId?: number;
  payGroupName?: string;
  salaryBasisOverride?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  remarks?: string;
}

interface PayGroup {
  id: number;
  name: string;
  salaryBasis: string;
  isActive?: boolean;
}

interface Props {
  employeeId: number;
  employeeName?: string;
  canEdit: boolean;
}

export const EmployeePayrollTab: React.FC<Props> = ({ employeeId, employeeName, canEdit }) => {
  const [records, setRecords] = useState<CTCRecord[]>([]);
  const [, setPayGroups] = useState<PayGroup[]>([]);
  const [assignedPayGroupId, setAssignedPayGroupId] = useState<number | null>(null);
  const [assignedPayGroupName, setAssignedPayGroupName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [form16ModalOpen, setForm16ModalOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultFy = currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ctcRes, pgRes] = await Promise.all([
        apiClient.get(`/pay-groups/employee-ctc/${employeeId}`),
        apiClient.get('/pay-groups'),
      ]);
      const ctcData = ctcRes.data;
      if (Array.isArray(ctcData)) {
        setRecords(ctcData);
      } else {
        setRecords(ctcData?.records || []);
        setAssignedPayGroupId(ctcData?.assignedPayGroupId ?? null);
        setAssignedPayGroupName(ctcData?.assignedPayGroupName ?? null);
      }
      const groups: PayGroup[] = pgRes.data || [];
      setPayGroups(groups);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const activeRecord = records.find(r => !r.effectiveTo);
  const currentAssignedId = assignedPayGroupId || activeRecord?.payGroupId || records[0]?.payGroupId;
  const currentGroupName = assignedPayGroupName || activeRecord?.payGroupName;

  return (
    <div className="space-y-6 font-ui">
      {loading ? (
        <div className="h-20 flex items-center justify-center text-[var(--text-muted)] text-sm">
          Loading payroll details...
        </div>
      ) : (
        <>
          {/* Active CTC */}
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee size={13} className="text-[var(--accent)]" /> Salary / CTC
              </h3>
              {canEdit && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="btn-primary text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> {activeRecord ? 'Revise CTC' : 'Assign CTC'}
                </button>
              )}
            </div>

            {activeRecord ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Annual CTC', `₹${activeRecord.annualCTC.toLocaleString('en-IN')}`],
                  ['Monthly CTC', `₹${activeRecord.monthlyCTC.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
                  ['Pay Group', activeRecord.payGroupName || assignedPayGroupName || '—'],
                  ['Effective From', activeRecord.effectiveFrom],
                ].map(([lbl, val]) => (
                  <div key={lbl} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] block">{lbl}</span>
                    <p className="font-semibold text-[var(--text-primary)] mt-0.5 text-sm font-mono">{val}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-primary)] font-medium">No CTC assigned yet.</p>
                  {assignedPayGroupName && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Assigned Pay Group: <strong className="text-[var(--text-primary)]">{assignedPayGroupName}</strong>
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => setModalOpen(true)}
                    className="btn-primary text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Assign CTC
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Income Tax (IT) Declaration & TDS */}
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-1.5">
                  <Landmark size={13} className="text-[var(--accent)]" /> Income Tax (IT) Declaration & TDS
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Tax regime (Old vs New Sec 115BAC), Chapter VI-A deductions (80C, 80D), HRA exemptions & monthly TDS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaxModalOpen(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 font-medium cursor-pointer"
              >
                <Landmark size={12} /> Manage Declaration
              </button>
            </div>
          </div>

          {/* Form 16 (Part B) Certificate */}
          <div className="p-4 border border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-1.5">
                  <FileText size={13} className="text-[var(--accent)]" /> Form 16 (Part B) Certificate
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Statutory Certificate under Section 203 of the Income-tax Act showing annual salary, Sec 16 deductions, Chapter VI-A tax credits, and TDS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm16ModalOpen(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 font-medium cursor-pointer"
              >
                <FileText size={12} className="text-[var(--accent)]" /> View Form 16
              </button>
            </div>
          </div>

          {/* CTC History */}
          {records.length > 1 && (
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide mb-2">CTC History</h3>
              <div className="space-y-1.5">
                {records.slice(1).map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)] shadow-xs opacity-80"
                  >
                    <div>
                      <span className="font-semibold text-sm text-[var(--text-primary)] font-mono">
                        ₹{r.annualCTC.toLocaleString('en-IN')} / year
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] ml-2">{r.payGroupName}</span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {r.effectiveFrom} → {r.effectiveTo ?? 'superseded'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Reusable Standard AssignCTCModal */}
      {modalOpen && (
        <AssignCTCModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          employeeId={employeeId}
          employeeName={employeeName}
          currentAnnualCTC={activeRecord?.annualCTC}
          currentPayGroupId={currentAssignedId ? Number(currentAssignedId) : undefined}
          currentPayGroupName={currentGroupName || undefined}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {taxModalOpen && (
        <TaxDeclarationModal
          isOpen={taxModalOpen}
          employeeId={employeeId}
          financialYear={defaultFy}
          onClose={() => setTaxModalOpen(false)}
          onSaved={() => {
            fetchData();
          }}
        />
      )}

      {form16ModalOpen && (
        <Form16Modal
          open={form16ModalOpen}
          onClose={() => setForm16ModalOpen(false)}
          employeeId={employeeId}
          employeeName={employeeName}
          initialFinancialYear={defaultFy}
        />
      )}
    </div>
  );
};
