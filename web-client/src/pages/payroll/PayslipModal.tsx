import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/PageSkeleton';

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  payslip: any | null;
}

export const PayslipModal: React.FC<Props> = ({ open, onClose, loading, payslip }) => {
  if (!open) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print-specific style overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-payslip-wrapper, #printable-payslip-wrapper * {
            visibility: visible;
          }
          #printable-payslip-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="printable-payslip-wrapper"
        className="bg-white border border-slate-300 rounded-lg shadow-2xl max-w-3xl w-full my-6 overflow-hidden print:border-none print:shadow-none print:my-0 print:max-w-none"
      >
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-slate-800">
              Salary Payslip Statement
            </span>
            {payslip?.monthDisplay && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                {payslip.monthDisplay}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Payslip Document Body */}
        {loading || !payslip ? (
          <div className="p-12 bg-white">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <div className="p-8 sm:p-10 bg-white text-slate-900 font-sans text-xs space-y-5 print:p-6 print:space-y-4">
            {/* 1. Formal Document Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold font-serif tracking-tight text-slate-900 uppercase">
                  {payslip.organization.name}
                </h1>
                {payslip.organization.address && (
                  <p className="text-[11px] text-slate-600 max-w-md">
                    {payslip.organization.address}
                  </p>
                )}
                <div className="text-[11px] text-slate-500 pt-0.5">
                  <span>Company Code: </span>
                  <span className="font-semibold font-mono text-slate-700">
                    {payslip.organization.code || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-base font-bold font-serif uppercase tracking-wide text-slate-900">
                  Payslip
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">
                  {payslip.monthDisplay}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 space-x-1.5">
                  <span>Status: <strong className="text-slate-800">{payslip.status}</strong></span>
                  {payslip.salaryBasis && <span>· Basis: {payslip.salaryBasis}</span>}
                </div>
              </div>
            </div>

            {/* 2. Employee Details Table */}
            <div className="border border-slate-300">
              <table className="w-full text-left border-collapse text-[11px]">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/4 py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      Employee Name
                    </td>
                    <td className="w-1/4 py-1.5 px-3 font-bold text-slate-900 border-r border-slate-200">
                      {payslip.employee.employeeName}
                    </td>
                    <td className="w-1/4 py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      Employee ID / Code
                    </td>
                    <td className="w-1/4 py-1.5 px-3 font-mono font-semibold text-slate-900">
                      {payslip.employee.employeeCode || `EMP#${String(payslip.employee.employeeId).padStart(3, '0')}`}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      Department
                    </td>
                    <td className="py-1.5 px-3 text-slate-800 border-r border-slate-200">
                      {payslip.employee.department || '—'}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      Designation
                    </td>
                    <td className="py-1.5 px-3 text-slate-800">
                      {payslip.employee.designation || '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      Bank Name / IFSC
                    </td>
                    <td className="py-1.5 px-3 font-mono text-slate-800 border-r border-slate-200">
                      {payslip.employee.ifsc || '—'}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      Bank A/C No.
                    </td>
                    <td className="py-1.5 px-3 font-mono text-slate-800">
                      {payslip.employee.bankAccount || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      PAN Number
                    </td>
                    <td className="py-1.5 px-3 font-mono text-slate-800 border-r border-slate-200">
                      {payslip.employee.pan || '—'}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200">
                      UAN / PF No.
                    </td>
                    <td className="py-1.5 px-3 font-mono text-slate-800">
                      {payslip.employee.uan || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. Attendance Summary Bar */}
            <div className="border border-slate-300">
              <table className="w-full text-center border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-sans text-[10px] uppercase tracking-wider border-b border-slate-300">
                    <th className="py-1.5 px-2 border-r border-slate-300 font-semibold">Days in Month</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 font-semibold">Present (P)</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 font-semibold">Week Off (WO)</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 font-semibold">Holidays (HLD)</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 font-semibold text-rose-700">Loss of Pay (LOP)</th>
                    <th className="py-1.5 px-2 font-semibold text-slate-900 bg-slate-200/50">Payable Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold text-slate-800">
                    <td className="py-1.5 px-2 border-r border-slate-200">{payslip.attendance.totalDays}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200">{payslip.attendance.presentDays}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200">{payslip.attendance.weekoffs}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200">{payslip.attendance.holidays}</td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-rose-700">{payslip.attendance.unpaidLeaves}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-900 bg-slate-200/50">{payslip.attendance.payableDays}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Earnings & Deductions Breakdown Table */}
            <div className="border border-slate-300">
              <div className="grid grid-cols-2 divide-x divide-slate-300">
                {/* Left Side: Earnings */}
                <div>
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-semibold text-[11px] uppercase tracking-wider text-slate-800 flex justify-between">
                    <span>Earnings</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="divide-y divide-slate-200 min-h-[120px]">
                    {payslip.earnings.map((e: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 flex justify-between text-[11px]">
                        <span className="text-slate-700">{e.componentName}</span>
                        <span className="font-mono font-medium text-slate-900">
                          ₹{Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {payslip.earnings.length === 0 && (
                      <div className="px-3 py-6 text-center text-slate-400 text-[11px] italic">
                        No earning components defined.
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 border-t border-slate-300 px-3 py-2 flex justify-between font-bold text-[11px] text-slate-900">
                    <span>Total Gross Earnings</span>
                    <span className="font-mono">
                      ₹{Number(payslip.totals.totalEarnings).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Right Side: Deductions */}
                <div>
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-semibold text-[11px] uppercase tracking-wider text-slate-800 flex justify-between">
                    <span>Deductions</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div className="divide-y divide-slate-200 min-h-[120px]">
                    {payslip.deductions.map((d: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 flex justify-between text-[11px]">
                        <span className="text-slate-700">{d.componentName}</span>
                        <span className="font-mono font-medium text-slate-900">
                          ₹{Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {payslip.deductions.length === 0 && (
                      <div className="px-3 py-6 text-center text-slate-400 text-[11px] italic">
                        No statutory or salary deductions.
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 border-t border-slate-300 px-3 py-2 flex justify-between font-bold text-[11px] text-slate-900">
                    <span>Total Deductions</span>
                    <span className="font-mono">
                      ₹{Number(payslip.totals.totalDeductions).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Net Salary Calculation Block */}
            <div className="border-2 border-slate-900 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-bold text-slate-700">
                  Net Salary Payable
                </div>
                <div className="text-xs text-slate-800 font-medium italic">
                  Amount in Words:{' '}
                  <span className="font-semibold not-italic">
                    {payslip.totals.netSalaryInWords || '—'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-slate-900">
                  ₹{Number(payslip.totals.netSalary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* 6. Legal / Formal Signatures Section */}
            <div className="pt-8 grid grid-cols-2 gap-12 text-[11px] text-slate-600">
              <div>
                <div className="h-12 border-b border-slate-400 w-48 mb-1.5" />
                <div className="font-semibold text-slate-800">Employee Signature</div>
                <div className="text-[10px] text-slate-400">Date: _______________</div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="h-12 border-b border-slate-400 w-48 mb-1.5" />
                <div className="font-semibold text-slate-800">Authorised Signatory</div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {payslip.organization.name}
                </div>
              </div>
            </div>

            {/* Document Footer Note */}
            <div className="pt-2 border-t border-slate-200 text-center text-[10px] text-slate-400 italic">
              This is a computer-generated salary slip issued by {payslip.organization.name}.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

