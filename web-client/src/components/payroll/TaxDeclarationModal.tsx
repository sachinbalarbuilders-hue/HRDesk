import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building,
  Home,
  HeartPulse,
  PiggyBank,
  Briefcase,
  ShieldCheck,
  Percent,
  XCircle,
  Sparkles,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

interface TaxDeclarationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number;
  financialYear: string;
  onSaved?: () => void;
}

type TabType = 'comparison' | 'sec80c' | 'sec80d' | 'hra' | 'other' | 'proofs';

export const TaxDeclarationModal: React.FC<TaxDeclarationModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  financialYear,
  onSaved
}) => {
  const { showSuccess, showError } = useToast();
  const { isAdmin, hasPermission } = useAuth();
  const canApprove = isAdmin || hasPermission('Payroll.ManageSalary');

  const [activeTab, setActiveTab] = useState<TabType>('comparison');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [proofs, setProofs] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    taxRegime: 'New',
    status: 'Draft',
    // 80C
    sec80C_EPF: '0',
    sec80C_PPF: '0',
    sec80C_ELSS: '0',
    sec80C_LifeInsurance: '0',
    sec80C_TuitionFees: '0',
    sec80C_HomeLoanPrincipal: '0',
    sec80C_Other: '0',
    // 80D
    sec80D_SelfFamily: '0',
    sec80D_Parents: '0',
    sec80D_ParentsSeniorCitizen: false,
    sec80D_PreventiveCheckup: '0',
    // NPS & Sec 24
    sec80CCD_NPS: '0',
    sec24_HomeLoanInterest: '0',
    lenderName: '',
    lenderPAN: '',
    // HRA
    annualRentPaid: '0',
    rentalCityType: 'NonMetro',
    landlordName: '',
    landlordPAN: '',
    // Other
    sec80E_EducationLoanInterest: '0',
    sec80G_Donations: '0',
    sec80TTA_SavingsInterest: '0',
    otherIncome: '0',
    previousEmployerGross: '0',
    previousEmployerTDS: '0',
    remarks: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tax-declarations/employee/${employeeId}?financialYear=${financialYear}`);
      const data = res.data;
      if (data) {
        setEmployeeData(data.employee);
        setComparison(data.comparison);
        if (data.declaration) {
          const d = data.declaration;
          setProofs(d.proofs || []);
          setFormData({
            taxRegime: d.taxRegime || 'New',
            status: d.status || 'Draft',
            sec80C_EPF: String(d.sec80C_EPF || 0),
            sec80C_PPF: String(d.sec80C_PPF || 0),
            sec80C_ELSS: String(d.sec80C_ELSS || 0),
            sec80C_LifeInsurance: String(d.sec80C_LifeInsurance || 0),
            sec80C_TuitionFees: String(d.sec80C_TuitionFees || 0),
            sec80C_HomeLoanPrincipal: String(d.sec80C_HomeLoanPrincipal || 0),
            sec80C_Other: String(d.sec80C_Other || 0),
            sec80D_SelfFamily: String(d.sec80D_SelfFamily || 0),
            sec80D_Parents: String(d.sec80D_Parents || 0),
            sec80D_ParentsSeniorCitizen: Boolean(d.sec80D_ParentsSeniorCitizen),
            sec80D_PreventiveCheckup: String(d.sec80D_PreventiveCheckup || 0),
            sec80CCD_NPS: String(d.sec80CCD_NPS || 0),
            sec24_HomeLoanInterest: String(d.sec24_HomeLoanInterest || 0),
            lenderName: d.lenderName || '',
            lenderPAN: d.lenderPAN || '',
            annualRentPaid: String(d.annualRentPaid || 0),
            rentalCityType: d.rentalCityType || 'NonMetro',
            landlordName: d.landlordName || '',
            landlordPAN: d.landlordPAN || '',
            sec80E_EducationLoanInterest: String(d.sec80E_EducationLoanInterest || 0),
            sec80G_Donations: String(d.sec80G_Donations || 0),
            sec80TTA_SavingsInterest: String(d.sec80TTA_SavingsInterest || 0),
            otherIncome: String(d.otherIncome || 0),
            previousEmployerGross: String(d.previousEmployerGross || 0),
            previousEmployerTDS: String(d.previousEmployerTDS || 0),
            remarks: d.remarks || ''
          });
        }
      }
    } catch (err) {
      showError('Error', 'Failed to load IT declaration details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchData();
    }
  }, [isOpen, employeeId, financialYear]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (submitStatus: 'Draft' | 'Submitted') => {
    try {
      setSaving(true);
      await apiClient.post('/tax-declarations', {
        employeeId,
        financialYear,
        taxRegime: formData.taxRegime,
        status: submitStatus,
        sec80C_EPF: Number(formData.sec80C_EPF) || 0,
        sec80C_PPF: Number(formData.sec80C_PPF) || 0,
        sec80C_ELSS: Number(formData.sec80C_ELSS) || 0,
        sec80C_LifeInsurance: Number(formData.sec80C_LifeInsurance) || 0,
        sec80C_TuitionFees: Number(formData.sec80C_TuitionFees) || 0,
        sec80C_HomeLoanPrincipal: Number(formData.sec80C_HomeLoanPrincipal) || 0,
        sec80C_Other: Number(formData.sec80C_Other) || 0,
        sec80D_SelfFamily: Number(formData.sec80D_SelfFamily) || 0,
        sec80D_Parents: Number(formData.sec80D_Parents) || 0,
        sec80D_ParentsSeniorCitizen: formData.sec80D_ParentsSeniorCitizen,
        sec80D_PreventiveCheckup: Number(formData.sec80D_PreventiveCheckup) || 0,
        sec80CCD_NPS: Number(formData.sec80CCD_NPS) || 0,
        sec24_HomeLoanInterest: Number(formData.sec24_HomeLoanInterest) || 0,
        lenderName: formData.lenderName,
        lenderPAN: formData.lenderPAN,
        annualRentPaid: Number(formData.annualRentPaid) || 0,
        rentalCityType: formData.rentalCityType,
        landlordName: formData.landlordName,
        landlordPAN: formData.landlordPAN,
        sec80E_EducationLoanInterest: Number(formData.sec80E_EducationLoanInterest) || 0,
        sec80G_Donations: Number(formData.sec80G_Donations) || 0,
        sec80TTA_SavingsInterest: Number(formData.sec80TTA_SavingsInterest) || 0,
        otherIncome: Number(formData.otherIncome) || 0,
        previousEmployerGross: Number(formData.previousEmployerGross) || 0,
        previousEmployerTDS: Number(formData.previousEmployerTDS) || 0,
        remarks: formData.remarks
      });

      showSuccess('Saved', `Declaration saved as ${submitStatus}.`);
      onSaved?.();
      fetchData();
    } catch (err) {
      showError('Error', 'Failed to save tax declaration.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (status: 'Approved' | 'Rejected') => {
    let reason = '';
    if (status === 'Rejected') {
      const input = prompt('Please enter a rejection reason for the employee:');
      if (input === null) return;
      reason = input.trim();
    }

    try {
      setSaving(true);
      const declId = comparison?.employeeId ? employeeId : 0;
      await apiClient.put(`/tax-declarations/${comparison?.declaration?.id || 0}/status`, {
        status,
        reason
      });
      showSuccess('Status Updated', `Declaration marked as ${status}.`);
      onSaved?.();
      fetchData();
    } catch {
      showError('Error', 'Failed to update declaration status.');
    } finally {
      setSaving(false);
    }
  };

  // 80C sum
  const total80C = (
    Number(formData.sec80C_EPF || 0) +
    Number(formData.sec80C_PPF || 0) +
    Number(formData.sec80C_ELSS || 0) +
    Number(formData.sec80C_LifeInsurance || 0) +
    Number(formData.sec80C_TuitionFees || 0) +
    Number(formData.sec80C_HomeLoanPrincipal || 0) +
    Number(formData.sec80C_Other || 0)
  );
  const eligible80C = Math.min(150000, total80C);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Income Tax (IT) Declaration & Regime Planner"
      description={`Financial Year ${financialYear} • ${employeeData?.fullName || 'Employee'} (${employeeData?.employeeCode || `EMP-${employeeId}`})`}
      size="4xl"
    >
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
          <Calculator className="animate-spin text-[var(--accent)]" size={28} />
          <span className="text-xs ">Computing tax projections...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Summary Strip */}
          <div className="bg-[var(--surface-sunken)] p-4 rounded-lg border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div>
                <span className="text-xs font-normal text-[var(--text-secondary)] uppercase  block">Annual CTC</span>
                <span className="text-sm font-semibold  text-[var(--text-primary)]">{formatCurrency(employeeData?.annualCTC)}</span>
              </div>
              <div className="hidden sm:block h-6 w-px bg-[var(--border)]" />
              <div>
                <span className="text-xs font-normal text-[var(--text-secondary)] uppercase  block">Department</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{employeeData?.department || '-'}</span>
              </div>
              <div className="hidden sm:block h-6 w-px bg-[var(--border)]" />
              <div>
                <span className="text-xs font-normal text-[var(--text-secondary)] uppercase  block">Current Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-normal font-medium  ${
                  formData.status === 'Approved' ? 'bg-[var(--ok-600)]/15 text-[var(--ok-600)]' :
                  formData.status === 'Submitted' ? 'bg-[var(--warn-600)]/15 text-[var(--warn-600)]' :
                  formData.status === 'Rejected' ? 'bg-[var(--err-600)]/15 text-[var(--err-600)]' :
                  'bg-[var(--rule)]/40 text-[var(--text-secondary)]'
                }`}>
                  {formData.status}
                </span>
              </div>
            </div>

            {/* Regime Selector Radio Pill */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="hidden sm:inline text-sm font-semibold text-[var(--text-secondary)]">Active Regime:</span>
              <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, taxRegime: 'New' }))}
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                    formData.taxRegime === 'New'
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  New Regime (115BAC)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, taxRegime: 'Old' }))}
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                    formData.taxRegime === 'Old'
                      ? 'bg-[var(--navy-900)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Old Regime
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-[var(--border)] gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap pb-1">
            {[
              { id: 'comparison', label: 'Regime Comparison', icon: Calculator },
              { id: 'sec80c', label: `Sec 80C (${formatCurrency(eligible80C)}/1.5L)`, icon: PiggyBank },
              { id: 'sec80d', label: 'Sec 80D (Medical)', icon: HeartPulse },
              { id: 'hra', label: 'HRA & Home Loan', icon: Home },
              { id: 'other', label: 'Other Incomes & NPS', icon: Briefcase },
              { id: 'proofs', label: 'Document Proofs', icon: ShieldCheck },
            ].map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as TabType)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                    isActive
                      ? 'border-[var(--accent)] text-[var(--accent-hover)] font-semibold'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Comparison */}
          {activeTab === 'comparison' && comparison && (
            <div className="space-y-4">
              {/* Recommendation Banner */}
              <div className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                comparison?.recommendedRegime === 'Old'
                  ? 'bg-[var(--gold-100)]/30 border-[var(--accent)] text-[var(--gold-800)]'
                  : 'bg-[var(--ok-600)]/10 border-[var(--ok-600)] text-[var(--ok-700)]'
              }`}>
                <div className="flex items-start md:items-center gap-3">
                  <Sparkles size={20} className={`shrink-0 mt-0.5 md:mt-0 ${comparison?.recommendedRegime === 'Old' ? 'text-[var(--accent-hover)]' : 'text-[var(--ok-600)]'}`} />
                  <div>
                    <h4 className="text-sm font-semibold">
                      Recommendation: Choose the <span className="font-semibold underline">{comparison?.recommendedRegime} Tax Regime</span>
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Based on current CTC and investments, the {comparison?.recommendedRegime} Regime saves{' '}
                      <span className="font-semibold ">{formatCurrency(comparison?.taxDifference)}</span> in annual income tax.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, taxRegime: comparison?.recommendedRegime }))}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap self-start md:self-auto"
                >
                  Apply {comparison?.recommendedRegime} Regime <ArrowRight size={12} />
                </button>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* New Regime Card */}
                <div className={`p-4 rounded-lg border transition-all ${
                  formData.taxRegime === 'New' ? 'border-[var(--accent)] shadow-xs ring-1 ring-[var(--accent)]/20' : 'border-[var(--border)]'
                } bg-[var(--surface)]`}>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">New Regime (Sec 115BAC)</h4>
                      <p className="text-xs font-normal text-[var(--text-secondary)]">Default regime with simplified lower slab rates</p>
                    </div>
                    {comparison.recommendedRegime === 'New' && (
                      <span className="px-2 py-0.5 text-xs font-normal font-semibold rounded bg-[var(--ok-600)] text-white">Recommended</span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Gross Annual Income:</span>
                      <span className=" font-medium text-[var(--text-primary)]">{formatCurrency(comparison.newRegime.grossIncome)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Standard Deduction:</span>
                      <span className=" font-medium text-[var(--ok-600)]">-{formatCurrency(comparison.newRegime.standardDeduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Other Deductions / 80C:</span>
                      <span className=" text-[var(--text-secondary)]">N/A (Disallowed)</span>
                    </div>
                    <div className="flex justify-between py-1 font-semibold text-[var(--text-primary)]">
                      <span>Net Taxable Income:</span>
                      <span className="">{formatCurrency(comparison.newRegime.netTaxableIncome)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-[var(--text-secondary)]">
                      <span>Tax Before Rebate:</span>
                      <span className="">{formatCurrency(comparison.newRegime.TaxBeforeRebate)}</span>
                    </div>
                    {comparison.newRegime.Section87ARebate > 0 && (
                      <div className="flex justify-between py-1 text-[var(--ok-600)]">
                        <span>Sec 87A Rebate:</span>
                        <span className="">-{formatCurrency(comparison.newRegime.Section87ARebate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 text-[var(--text-secondary)]">
                      <span>Health & Education Cess (4%):</span>
                      <span className="">{formatCurrency(comparison.newRegime.HealthAndEducationCess)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">
                      <span>Total Annual Tax:</span>
                      <span className=" text-[var(--err-600)]">{formatCurrency(comparison.newRegime.totalAnnualTax)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-xs font-normal text-[var(--text-secondary)] bg-[var(--surface-sunken)] p-2 rounded">
                      <span>Monthly Projected TDS:</span>
                      <span className=" font-semibold text-[var(--text-primary)]">{formatCurrency(comparison.newRegime.estimatedMonthlyTds)} / mo</span>
                    </div>
                  </div>
                </div>

                {/* Old Regime Card */}
                <div className={`p-4 rounded-lg border transition-all ${
                  formData.taxRegime === 'Old' ? 'border-[var(--navy-900)] shadow-xs ring-1 ring-[var(--navy-900)]/20' : 'border-[var(--border)]'
                } bg-[var(--surface)]`}>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">Old Regime</h4>
                      <p className="text-xs font-normal text-[var(--text-secondary)]">Standard rates with 80C, 80D, HRA & Sec 24 exemptions</p>
                    </div>
                    {comparison.recommendedRegime === 'Old' && (
                      <span className="px-2 py-0.5 text-xs font-normal font-semibold rounded bg-[var(--accent)] text-white">Recommended</span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Gross Annual Income:</span>
                      <span className=" font-medium text-[var(--text-primary)]">{formatCurrency(comparison.oldRegime.grossIncome)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Standard Deduction:</span>
                      <span className=" font-medium text-[var(--ok-600)]">-{formatCurrency(comparison.oldRegime.standardDeduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">HRA Exemption:</span>
                      <span className=" font-medium text-[var(--ok-600)]">-{formatCurrency(comparison.oldRegime.HraExemption)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Section 80C Deductions:</span>
                      <span className=" font-medium text-[var(--ok-600)]">-{formatCurrency(comparison.oldRegime.Section80CDeduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Section 80D (Medical):</span>
                      <span className=" font-medium text-[var(--ok-600)]">-{formatCurrency(comparison.oldRegime.Section80DDeduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border)]/50">
                      <span className="text-[var(--text-secondary)]">Home Loan Interest (Sec 24):</span>
                      <span className=" font-medium text-[var(--ok-600)]">-{formatCurrency(comparison.oldRegime.Section24Deduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 font-semibold text-[var(--text-primary)]">
                      <span>Net Taxable Income:</span>
                      <span className="">{formatCurrency(comparison.oldRegime.netTaxableIncome)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-[var(--text-secondary)]">
                      <span>Tax Before Rebate:</span>
                      <span className="">{formatCurrency(comparison.oldRegime.TaxBeforeRebate)}</span>
                    </div>
                    {comparison.oldRegime.Section87ARebate > 0 && (
                      <div className="flex justify-between py-1 text-[var(--ok-600)]">
                        <span>Sec 87A Rebate:</span>
                        <span className="">-{formatCurrency(comparison.oldRegime.Section87ARebate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 text-[var(--text-secondary)]">
                      <span>Health & Education Cess (4%):</span>
                      <span className="">{formatCurrency(comparison.oldRegime.HealthAndEducationCess)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t-2 border-[var(--border)] text-sm font-semibold text-[var(--text-primary)]">
                      <span>Total Annual Tax:</span>
                      <span className=" text-[var(--err-600)]">{formatCurrency(comparison.oldRegime.totalAnnualTax)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-xs font-normal text-[var(--text-secondary)] bg-[var(--surface-sunken)] p-2 rounded">
                      <span>Monthly Projected TDS:</span>
                      <span className=" font-semibold text-[var(--text-primary)]">{formatCurrency(comparison.oldRegime.estimatedMonthlyTds)} / mo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Section 80C */}
          {activeTab === 'sec80c' && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Section 80C Deductions Limit</span>
                  <p className="text-xs font-normal text-[var(--text-secondary)]">Maximum permissible deduction across all 80C components is ₹1,50,000</p>
                </div>
                <div className="text-right ">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(eligible80C)}</span>
                  <span className="text-xs text-[var(--text-secondary)]"> / ₹1,50,000</span>
                  <div className="w-32 bg-[var(--border)] h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-[var(--accent)] h-full transition-all"
                      style={{ width: `${Math.min(100, (total80C / 150000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Employee PF Contribution (EPF)</label>
                  <Input type="number" name="sec80C_EPF" value={formData.sec80C_EPF} onChange={handleChange} min="0" />
                  <p className="text-xs font-normal text-[var(--text-secondary)]">Auto-calculated employee contribution to Provident Fund</p>
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Public Provident Fund (PPF)</label>
                  <Input type="number" name="sec80C_PPF" value={formData.sec80C_PPF} onChange={handleChange} min="0" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">ELSS Tax Saving Mutual Funds</label>
                  <Input type="number" name="sec80C_ELSS" value={formData.sec80C_ELSS} onChange={handleChange} min="0" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Life Insurance Premium (LIC / Term)</label>
                  <Input type="number" name="sec80C_LifeInsurance" value={formData.sec80C_LifeInsurance} onChange={handleChange} min="0" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Children Tuition Fees (Max 2 children)</label>
                  <Input type="number" name="sec80C_TuitionFees" value={formData.sec80C_TuitionFees} onChange={handleChange} min="0" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Home Loan Principal Repayment</label>
                  <Input type="number" name="sec80C_HomeLoanPrincipal" value={formData.sec80C_HomeLoanPrincipal} onChange={handleChange} min="0" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="font-medium text-[var(--text-primary)]">Other 80C Instruments (NSC, Sukanya Samriddhi, 5+ Yr Tax Saving FD)</label>
                  <Input type="number" name="sec80C_Other" value={formData.sec80C_Other} onChange={handleChange} min="0" />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Section 80D */}
          {activeTab === 'sec80d' && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                Health Insurance Premiums under Section 80D: Self/Family (Max ₹25,000) + Parents (Max ₹25,000, or ₹50,000 if senior citizen).
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Mediclaim Premium (Self, Spouse & Children)</label>
                  <Input type="number" name="sec80D_SelfFamily" value={formData.sec80D_SelfFamily} onChange={handleChange} min="0" />
                  <p className="text-xs font-normal text-[var(--text-secondary)]">Max deduction: ₹25,000</p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Preventive Health Check-up</label>
                  <Input type="number" name="sec80D_PreventiveCheckup" value={formData.sec80D_PreventiveCheckup} onChange={handleChange} min="0" />
                  <p className="text-xs font-normal text-[var(--text-secondary)]">Capped at ₹5,000 across self and family</p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Parents Medical Insurance Premium</label>
                  <Input type="number" name="sec80D_Parents" value={formData.sec80D_Parents} onChange={handleChange} min="0" />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="sec80D_ParentsSeniorCitizen"
                    name="sec80D_ParentsSeniorCitizen"
                    checked={formData.sec80D_ParentsSeniorCitizen}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <label htmlFor="sec80D_ParentsSeniorCitizen" className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Parents are Senior Citizens (Age 60+, increases limit to ₹50,000)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: HRA & Home Loan */}
          {activeTab === 'hra' && (
            <div className="space-y-4">
              <div className="p-3 bg-[var(--surface-sunken)] rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                HRA exemption under Section 10(13A) is calculated as the minimum of Actual HRA, Rent paid - 10% basic, or 50%/40% basic.
              </div>

              <div className="border border-[var(--border)] p-4 rounded-lg space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                  <Home size={14} className="text-[var(--accent)]" /> House Rent Allowance (HRA) Exemption
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Annual Rent Paid (₹)</label>
                    <Input type="number" name="annualRentPaid" value={formData.annualRentPaid} onChange={handleChange} min="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Rental City Category</label>
                    <select
                      name="rentalCityType"
                      value={formData.rentalCityType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm font-semibold"
                    >
                      <option value="NonMetro">Non-Metro (40% of Basic)</option>
                      <option value="Metro">Metro: Mumbai, Delhi, Kolkata, Chennai (50% of Basic)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Landlord Name</label>
                    <Input type="text" name="landlordName" value={formData.landlordName} onChange={handleChange} placeholder="Required if rent > ₹1L" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Landlord PAN</label>
                    <Input type="text" name="landlordPAN" value={formData.landlordPAN} onChange={handleChange} placeholder="ABCDE1234F (Mandatory if rent > ₹1L/yr)" />
                  </div>
                </div>
              </div>

              <div className="border border-[var(--border)] p-4 rounded-lg space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                  <Building size={14} className="text-[var(--navy-900)]" /> Section 24(b) Home Loan Interest
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Annual Interest Paid (Max ₹2,00,000)</label>
                    <Input type="number" name="sec24_HomeLoanInterest" value={formData.sec24_HomeLoanInterest} onChange={handleChange} min="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Lender / Financial Bank</label>
                    <Input type="text" name="lenderName" value={formData.lenderName} onChange={handleChange} placeholder="e.g. HDFC Bank, SBI" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-[var(--text-primary)]">Lender PAN</label>
                    <Input type="text" name="lenderPAN" value={formData.lenderPAN} onChange={handleChange} placeholder="Bank PAN" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Other Incomes & NPS */}
          {activeTab === 'other' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Section 80CCD(1B) - NPS Additional Contribution</label>
                  <Input type="number" name="sec80CCD_NPS" value={formData.sec80CCD_NPS} onChange={handleChange} min="0" />
                  <p className="text-xs font-normal text-[var(--text-secondary)]">Exclusive deduction up to ₹50,000 over and above 80C</p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Section 80E - Education Loan Interest</label>
                  <Input type="number" name="sec80E_EducationLoanInterest" value={formData.sec80E_EducationLoanInterest} onChange={handleChange} min="0" />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Section 80G - Eligible Charitable Donations</label>
                  <Input type="number" name="sec80G_Donations" value={formData.sec80G_Donations} onChange={handleChange} min="0" />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Section 80TTA - Savings Account Interest (Max ₹10k)</label>
                  <Input type="number" name="sec80TTA_SavingsInterest" value={formData.sec80TTA_SavingsInterest} onChange={handleChange} min="0" />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Income from Other Sources / Interest</label>
                  <Input type="number" name="otherIncome" value={formData.otherIncome} onChange={handleChange} min="0" />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Previous Employer Taxable Salary</label>
                  <Input type="number" name="previousEmployerGross" value={formData.previousEmployerGross} onChange={handleChange} min="0" />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">TDS Deducted by Previous Employer</label>
                  <Input type="number" name="previousEmployerTDS" value={formData.previousEmployerTDS} onChange={handleChange} min="0" />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-primary)]">Declaration Notes / Remarks</label>
                  <textarea
                    name="remarks"
                    rows={2}
                    value={formData.remarks}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-xs"
                    placeholder="Optional notes or references..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Proofs */}
          {activeTab === 'proofs' && (
            <div className="space-y-6 text-xs">
              {/* Upload Form */}
              {formData.status !== 'Approved' && (
                <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
                  <h4 className="font-semibold text-sm mb-3">Upload New Proof</h4>
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1 w-full">
                      <label className="font-medium">Document Type</label>
                      <select 
                        id="proofTypeSelect"
                        className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-xs"
                      >
                        <option value="80C_Investments">80C Investments (LIC, PPF, ELSS)</option>
                        <option value="80D_Medical">80D Medical Insurance</option>
                        <option value="HRA_RentAgreement">HRA Rent Agreement / Receipts</option>
                        <option value="HomeLoan_Certificate">Home Loan Interest Certificate</option>
                        <option value="Previous_Employer">Previous Employer Form 16</option>
                        <option value="Other">Other Document</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1 w-full">
                      <label className="font-medium">File (PDF/JPG/PNG, Max 5MB)</label>
                      <input 
                        type="file" 
                        id="proofFileInput"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary py-2 px-4 whitespace-nowrap"
                      disabled={saving}
                      onClick={async () => {
                        const fileInput = document.getElementById('proofFileInput') as HTMLInputElement;
                        const typeSelect = document.getElementById('proofTypeSelect') as HTMLSelectElement;
                        const file = fileInput?.files?.[0];
                        if (!file) {
                          showError('Error', 'Please select a file first.');
                          return;
                        }
                        const fd = new FormData();
                        fd.append('proofType', typeSelect.value);
                        fd.append('file', file);
                        
                        try {
                          setSaving(true);
                          await apiClient.post(`/tax-declarations/${comparison?.declaration?.id || 0}/proofs`, fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          showSuccess('Uploaded', 'Proof document uploaded successfully.');
                          fileInput.value = '';
                          fetchData();
                        } catch (e: any) {
                          showError('Upload Failed', e.response?.data?.message || 'Failed to upload proof.');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Upload
                    </button>
                  </div>
                </div>
              )}

              {/* Proofs List */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Uploaded Documents ({proofs.length})</h4>
                {proofs.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-secondary)] border border-dashed rounded-lg">
                    No proofs uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {proofs.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-[var(--surface)]">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="text-[var(--accent)]" size={18} />
                          <div>
                            <p className="font-medium text-sm">{p.proofType}</p>
                            <p className="text-xs font-normal text-[var(--text-secondary)]">
                              {p.fileName} • {new Date(p.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={p.filePath} 
                            target="_blank" 
                            rel="noreferrer"
                            className="px-3 py-1 bg-[var(--surface-sunken)] hover:bg-[var(--rule)] rounded text-sm font-semibold transition-colors"
                          >
                            View
                          </a>
                          {formData.status !== 'Approved' && (
                            <button
                              type="button"
                              className="px-3 py-1 bg-[var(--err-500)]/10 text-[var(--err-600)] hover:bg-[var(--err-500)]/20 rounded text-sm font-semibold transition-colors"
                              onClick={async () => {
                                if (!confirm('Are you sure you want to delete this proof?')) return;
                                try {
                                  setSaving(true);
                                  await apiClient.delete(`/tax-declarations/${comparison?.declaration?.id}/proofs/${p.id}`);
                                  showSuccess('Deleted', 'Proof removed.');
                                  fetchData();
                                } catch {
                                  showError('Error', 'Failed to delete proof.');
                                } finally {
                                  setSaving(false);
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canApprove && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdateStatus('Approved')}
                    className="px-3 py-2 text-sm font-semibold rounded-md bg-[var(--ok-600)] text-white hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve Declaration
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdateStatus('Rejected')}
                    className="px-3 py-2 text-sm font-semibold rounded-md border border-[var(--err-600)] text-[var(--err-600)] hover:bg-[var(--err-600)]/10 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('Draft')}
                className="px-4 py-2 text-sm font-semibold rounded-md border border-[var(--border)] text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)] cursor-pointer disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('Submitted')}
                className="btn-primary px-4 py-2 text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                Submit Declaration
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

