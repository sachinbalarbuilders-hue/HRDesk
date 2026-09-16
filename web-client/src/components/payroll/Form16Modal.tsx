import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { TableSkeleton } from '../ui/PageSkeleton';

interface Form16Employer {
  name: string;
  address?: string;
  pan?: string;
  tan?: string;
  signatoryName: string;
  signatoryDesignation: string;
  signatoryFatherName?: string;
}

interface Form16Employee {
  employeeId: number;
  employeeCode: string;
  name: string;
  pan?: string;
  address?: string;
  department?: string;
  designation?: string;
  joiningDate?: string;
  taxRegime: string;
}

interface Form16DeductionItem {
  section: string;
  description: string;
  grossAmount: number;
  deductibleAmount: number;
}

interface TaxSlab {
  slabRange: string;
  ratePercent: number;
  taxableAmount: number;
  taxAmount: number;
}

interface Form16Data {
  certificateNumber: string;
  assessmentYear: string;
  financialYear: string;
  periodFrom: string;
  periodTo: string;
  employer: Form16Employer;
  employee: Form16Employee;
  salarySec17_1: number;
  perquisitesSec17_2: number;
  profitsInLieuSec17_3: number;
  totalCurrentEmployerSalary: number;
  previousEmployerSalary: number;
  grossSalaryTotal: number;
  hraExemptionSec10_13A: number;
  otherExemptionsSec10: number;
  totalExemptionsSec10: number;
  balanceSalary: number;
  standardDeductionSec16_ia: number;
  entertainmentAllowanceSec16_ii: number;
  taxOnEmploymentSec16_iii: number;
  totalDeductionsSec16: number;
  incomeChargeableSalaries: number;
  housePropertyLossSec24_b: number;
  otherIncomeReported: number;
  grossTotalIncome: number;
  chapterVIA_Deductions: Form16DeductionItem[];
  totalChapterVIA_Deductions: number;
  totalTaxableIncome: number;
  slabBreakdown: TaxSlab[];
  taxOnTotalIncome: number;
  section87ARebate: number;
  taxAfterRebate: number;
  healthAndEducationCess: number;
  totalTaxPayable: number;
  section89Relief: number;
  netTaxPayable: number;
  tdsDeductedCurrentEmployer: number;
  tdsDeductedPreviousEmployer: number;
  totalTdsDeducted: number;
  taxPayableOrRefundable: number;
  isDraft: boolean;
  generatedAt: string;
  place: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  employeeId: number;
  employeeName?: string;
  initialFinancialYear?: string;
}

export const Form16Modal: React.FC<Props> = ({
  open,
  onClose,
  employeeId,
  employeeName,
  initialFinancialYear,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultFy = initialFinancialYear || (currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`);

  const [financialYear, setFinancialYear] = useState(defaultFy);
  const [data, setData] = useState<Form16Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForm16 = async (fy: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<Form16Data>(`/form16/${employeeId}?financialYear=${fy}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load Form 16 data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && employeeId > 0) {
      fetchForm16(financialYear);
    }
  }, [open, employeeId, financialYear]);

  if (!open) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-form16-body');
    if (!printContent) {
      window.print();
      return;
    }

    // Remove any stale print iframe
    const oldIframe = document.getElementById('form16-print-iframe');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'form16-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Gather styles from host document
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Form 16 Part B - ${data?.employee?.name || 'Certificate'} (${data?.financialYear || ''})</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 10mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            html, body {
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            .no-print {
              display: none !important;
            }
            tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            table {
              border-color: #cbd5e1 !important;
            }
          </style>
        </head>
        <body class="bg-white text-slate-900 p-2">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 2500);
    }, 250);
  };

  const fmt = (n?: number) =>
    (n ?? 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtInt = (n?: number) =>
    Math.round(n ?? 0).toLocaleString('en-IN');

  return createPortal(
    <div
      id="form16-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static animate-in fade-in duration-150 flex items-start sm:items-center justify-center"
    >
      {/* Print stylesheet for Ctrl+P */}
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          #form16-modal-overlay {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          #printable-form16-wrapper {
            position: static !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            font-size: 11px !important;
          }
          #printable-form16-body {
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="printable-form16-wrapper"
        className="bg-white border border-slate-300 rounded-lg shadow-2xl max-w-4xl w-full my-auto max-h-[92vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:my-0 print:max-h-none print:max-w-none text-slate-900 font-sans"
      >
        {/* Top Controls Bar (Pinned to top, hidden on print) */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 shrink-0 z-10 no-print">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm text-slate-900">
                  Form 16 (Part B)
                </span>
                {data?.isDraft && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    PROVISIONAL / DRAFT
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {employeeName || data?.employee.name} {data?.employee.employeeCode && `(${data.employee.employeeCode})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-600 font-medium">FY:</span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="2026-2027">2026-2027 (AY 2027-28)</option>
                <option value="2025-2026">2025-2026 (AY 2026-27)</option>
                <option value="2024-2025">2024-2025 (AY 2025-26)</option>
              </select>
            </div>

            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-12 bg-white flex-1 overflow-y-auto">
            <TableSkeleton rows={10} />
          </div>
        ) : error || !data ? (
          <div className="p-12 text-center text-slate-600 space-y-3 flex-1 overflow-y-auto">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="text-sm font-medium">{error || 'No data available for this employee.'}</p>
            <button
              onClick={() => fetchForm16(financialYear)}
              className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div id="printable-form16-body" className="p-6 sm:p-8 bg-white text-slate-900 text-xs space-y-6 flex-1 overflow-y-auto print:p-4 print:space-y-4 print:overflow-visible print:max-h-none">
            {/* Draft Notice if fiscal year not finalized */}
            {data.isDraft && (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2 no-print">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Provisional Form 16 Part B Projection:</strong> The selected financial year is ongoing. Unprocessed months are estimated based on active CTC. Final statutory Form 16 Part B will be sealed at fiscal year-end.
                </div>
              </div>
            )}

            {/* 1. Official Statutory Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <h1 className="text-base sm:text-lg font-bold font-serif tracking-wide uppercase text-slate-900">
                FORM NO. 16
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">[See rule 31(1)(a)]</p>
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
                PART B
              </h2>
              <p className="text-[11px] text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary paid to an employee or central / state government or other employers
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-700">
                <span>Certificate No: <strong className="text-slate-900">{data.certificateNumber}</strong></span>
                <span>•</span>
                <span>Assessment Year: <strong className="text-slate-900">{data.assessmentYear}</strong></span>
                <span>•</span>
                <span>Financial Year: <strong className="text-slate-900">{data.financialYear}</strong></span>
              </div>
            </div>

            {/* 2. Employer and Employee Identification Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-300 rounded p-3.5 bg-slate-50/50">
              {/* Employer Details */}
              <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Employer / Deductor Details
                </div>
                <div className="font-bold font-serif text-sm text-slate-900">
                  {data.employer.name}
                </div>
                {data.employer.address && (
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {data.employer.address}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">PAN of Employer</span>
                    <strong className="text-slate-800">{data.employer.pan || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">TAN of Employer</span>
                    <strong className="text-slate-800">{data.employer.tan || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Employee Details */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center justify-between">
                  <span>Employee / Deductee Details</span>
                  <span className="px-1.5 py-0.2 rounded font-mono font-semibold text-[10px] bg-slate-200 text-slate-800">
                    {data.employee.taxRegime === 'Old' ? 'Old Regime' : 'New Regime (115BAC)'}
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900">
                  {data.employee.name}
                  <span className="ml-2 font-mono text-xs font-normal text-slate-600">
                    ({data.employee.employeeCode})
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  <span>Dept: <strong>{data.employee.department}</strong></span>
                  <span className="mx-1.5">•</span>
                  <span>Desig: <strong>{data.employee.designation}</strong></span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">PAN of Employee</span>
                    <strong className="text-slate-800">{data.employee.pan || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Period with Employer</span>
                    <span className="text-slate-800">{data.periodFrom} to {data.periodTo}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Statutory Form 16 Table Schedule */}
            <div className="border border-slate-300 overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                    <th className="p-2 w-10 text-center border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">Particulars</th>
                    <th className="p-2 w-32 text-right border-r border-slate-300">Amount (₹)</th>
                    <th className="p-2 w-36 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                  {/* Row 1: Gross Salary */}
                  <tr className="bg-slate-50/70 font-sans font-semibold text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300">1</td>
                    <td className="p-2 border-r border-slate-300" colSpan={2}>
                      Gross Salary
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {fmt(data.grossSalaryTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      (a) Salary as per provisions contained in sec. 17(1)
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.salarySec17_1)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      (b) Value of perquisites under section 17(2)
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.perquisitesSec17_2)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      (c) Profits in lieu of salary under section 17(3)
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.profitsInLieuSec17_3)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>
                  {data.previousEmployerSalary > 0 && (
                    <tr>
                      <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                      <td className="p-2 border-r border-slate-300 font-sans pl-6">
                        (d) Reported total salary from previous employer(s)
                      </td>
                      <td className="p-2 text-right border-r border-slate-300">
                        {fmt(data.previousEmployerSalary)}
                      </td>
                      <td className="p-2 text-right"></td>
                    </tr>
                  )}

                  {/* Row 2: Allowances exempt u/s 10 */}
                  <tr className="bg-slate-50/70 font-sans font-semibold text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300">2</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Less: Allowances to the extent exempt under section 10
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {fmt(data.totalExemptionsSec10)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      (a) House Rent Allowance under section 10(13A)
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.hraExemptionSec10_13A)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>

                  {/* Row 3: Balance */}
                  <tr className="font-semibold">
                    <td className="p-2 text-center border-r border-slate-300 font-sans">3</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Balance (1 - 2)
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmt(data.balanceSalary)}
                    </td>
                  </tr>

                  {/* Row 4: Deductions under Section 16 */}
                  <tr className="bg-slate-50/70 font-sans font-semibold text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300">4</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Less: Deductions under section 16
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {fmt(data.totalDeductionsSec16)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      (a) Standard deduction under section 16(ia)
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.standardDeductionSec16_ia)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      (b) Tax on employment under section 16(iii) (Professional Tax)
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.taxOnEmploymentSec16_iii)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>

                  {/* Row 5: Income under Salaries */}
                  <tr className="font-semibold bg-slate-50/40">
                    <td className="p-2 text-center border-r border-slate-300 font-sans">5</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Income chargeable under the head 'Salaries' (3 - 4)
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      {fmt(data.incomeChargeableSalaries)}
                    </td>
                  </tr>

                  {/* Row 6: Other Incomes / Loss from House Property */}
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans">6</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Add / (Less): Any other income / permissible house property loss u/s 24(b)
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmt(data.otherIncomeReported - data.housePropertyLossSec24_b)}
                    </td>
                  </tr>

                  {/* Row 7: Gross Total Income */}
                  <tr className="font-bold bg-slate-100 border-t border-b border-slate-300 text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300 font-sans">7</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Gross Total Income (5 + 6)
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmt(data.grossTotalIncome)}
                    </td>
                  </tr>

                  {/* Row 8: Chapter VI-A Deductions */}
                  <tr className="bg-slate-50/70 font-sans font-semibold text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300">8</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Deductions under Chapter VI-A
                      {data.employee.taxRegime === 'New' && (
                        <span className="text-[10px] font-normal text-slate-500 block italic">
                          (Not applicable under Section 115BAC New Tax Regime)
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {fmt(data.totalChapterVIA_Deductions)}
                    </td>
                  </tr>
                  {data.chapterVIA_Deductions && data.chapterVIA_Deductions.length > 0 ? (
                    data.chapterVIA_Deductions.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                        <td className="p-2 border-r border-slate-300 font-sans pl-6">
                          <span className="font-semibold text-slate-900">{item.section}</span>: {item.description}
                          <span className="text-[10px] text-slate-500 block font-mono">
                            Declared: ₹{fmt(item.grossAmount)}
                          </span>
                        </td>
                        <td className="p-2 text-right border-r border-slate-300">
                          {fmt(item.deductibleAmount)}
                        </td>
                        <td className="p-2 text-right"></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                      <td className="p-2 border-r border-slate-300 font-sans pl-6 text-slate-500 italic" colSpan={2}>
                        No Chapter VI-A deductions claimed / eligible under selected regime.
                      </td>
                      <td className="p-2 text-right"></td>
                    </tr>
                  )}

                  {/* Row 9: Total Taxable Income */}
                  <tr className="font-bold bg-slate-100 border-t-2 border-b-2 border-slate-900 text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300 font-sans">9</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Total Taxable Income (7 - 8) [Rounded off u/s 288A]
                    </td>
                    <td className="p-2 text-right font-mono text-sm">
                      ₹{fmtInt(data.totalTaxableIncome)}
                    </td>
                  </tr>

                  {/* Row 10: Tax Computation */}
                  <tr className="bg-slate-50/70 font-sans font-semibold text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300">10</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Tax on Total Income
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {fmt(data.taxOnTotalIncome)}
                    </td>
                  </tr>

                  {/* Slabs sub-table */}
                  {data.slabBreakdown && data.slabBreakdown.length > 0 && (
                    <tr>
                      <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                      <td className="p-2 border-r border-slate-300 font-sans pl-6" colSpan={3}>
                        <div className="py-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Slab Rates Breakdown:
                          </span>
                          <div className="space-y-0.5 text-[10px] font-mono">
                            {data.slabBreakdown.map((slab, i) => (
                              <div key={i} className="flex items-center justify-between text-slate-600">
                                <span>{slab.slabRange} @ {slab.ratePercent}%</span>
                                <span>Taxable: ₹{fmt(slab.taxableAmount)} → Tax: ₹{fmt(slab.taxAmount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      Less: Rebate under section 87A
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.section87ARebate)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6 font-semibold">
                      Tax payable after rebate
                    </td>
                    <td className="p-2 text-right border-r border-slate-300 font-semibold">
                      {fmt(data.taxAfterRebate)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6">
                      Add: Health and Education Cess @ 4%
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      {fmt(data.healthAndEducationCess)}
                    </td>
                    <td className="p-2 text-right"></td>
                  </tr>

                  {/* Net Tax Payable */}
                  <tr className="font-bold bg-slate-100 border-t border-slate-300 text-slate-900">
                    <td className="p-2 text-center border-r border-slate-300 font-sans">11</td>
                    <td className="p-2 border-r border-slate-300 font-sans" colSpan={2}>
                      Total Tax Payable [Rounded off u/s 288B]
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-sm">
                      ₹{fmtInt(data.totalTaxPayable)}
                    </td>
                  </tr>

                  {/* TDS Deducted */}
                  <tr>
                    <td className="p-2 text-center border-r border-slate-300 font-sans">12</td>
                    <td className="p-2 border-r border-slate-300 font-sans pl-6" colSpan={2}>
                      Less: Tax Deducted at Source (TDS)
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-700">
                      {fmt(data.totalTdsDeducted)}
                    </td>
                  </tr>
                  {data.tdsDeductedPreviousEmployer > 0 && (
                    <tr>
                      <td className="p-2 text-center border-r border-slate-300 font-sans"></td>
                      <td className="p-2 border-r border-slate-300 font-sans pl-10 text-[10px] text-slate-600">
                        • Current Employer: ₹{fmt(data.tdsDeductedCurrentEmployer)} | Previous Employer: ₹{fmt(data.tdsDeductedPreviousEmployer)}
                      </td>
                      <td className="p-2 text-right border-r border-slate-300" colSpan={2}></td>
                    </tr>
                  )}

                  {/* Tax Payable / Refundable */}
                  <tr className="font-bold bg-slate-900 text-white">
                    <td className="p-2 text-center border-r border-slate-700 font-sans">13</td>
                    <td className="p-2 border-r border-slate-700 font-sans" colSpan={2}>
                      {data.taxPayableOrRefundable >= 0 ? 'Tax Payable / (Due)' : 'Tax Refundable'}
                    </td>
                    <td className="p-2 text-right font-mono text-sm">
                      ₹{fmtInt(Math.abs(data.taxPayableOrRefundable))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Official Verification Declaration */}
            <div className="border border-slate-300 p-4 rounded bg-slate-50/50 space-y-4">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Verification & Statutory Declaration
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                I, <strong className="text-slate-900">{data.employer.signatoryName}</strong>
                {data.employer.signatoryFatherName ? `, son / daughter of ${data.employer.signatoryFatherName}` : ''},
                working in the capacity of <strong className="text-slate-900">{data.employer.signatoryDesignation}</strong> do hereby certify that a sum of{' '}
                <strong className="text-slate-900">₹{fmt(data.totalTdsDeducted)}</strong> [Rupees{' '}
                {fmtInt(data.totalTdsDeducted)} only] has been deducted and a copy of this statement is true, complete and correct based on the books of account, documents, payroll records and other available particulars of{' '}
                <strong className="text-slate-900">{data.employer.name}</strong>.
              </p>

              <div className="flex items-end justify-between pt-4 border-t border-slate-200 text-[11px]">
                <div className="space-y-1">
                  <div>Place: <strong className="text-slate-800">{data.place || 'Bengaluru'}</strong></div>
                  <div>Date: <strong className="text-slate-800">{data.generatedAt}</strong></div>
                </div>

                <div className="text-right space-y-1">
                  <div className="h-10 border-b border-dashed border-slate-400 w-44 ml-auto"></div>
                  <div className="font-semibold text-slate-900">{data.employer.signatoryName}</div>
                  <div className="text-[10px] text-slate-500">{data.employer.signatoryDesignation}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
