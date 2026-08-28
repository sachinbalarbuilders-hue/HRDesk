import React from 'react';
import { X, FileText, Printer } from 'lucide-react';
import { TableSkeleton } from '../../components/ui/PageSkeleton';

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  payslip: any | null;
}

export const PayslipModal: React.FC<Props> = ({ open, onClose, loading, payslip }) => {
  if (!open) return null;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden">
        {/* Controls bar */}
        <div className="p-3 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)] no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent)]" />
            <span className="font-serif font-bold text-sm text-[var(--ink)]">Official Payslip Statement</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Payslip content */}
        {loading || !payslip ? (
          <div className="p-12"><TableSkeleton rows={8} /></div>
        ) : (
          <div className="p-8 bg-white text-slate-900 font-sans space-y-6 text-xs print:p-0">
            {/* 1. Company Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold tracking-tight text-slate-900 uppercase">
                  {payslip.organization.name}
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5">{payslip.organization.address}</p>
                <p className="text-[11px] text-slate-600">
                  Company Code: <span className="font-mono font-semibold">{payslip.organization.code}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-serif font-bold text-xs uppercase tracking-wider text-slate-800">
                  Payslip for {payslip.monthDisplay}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Status: <span className="font-semibold text-emerald-700">{payslip.status}</span>
                  {payslip.isLocked && <span className="ml-2">🔒 Locked</span>}
                  {payslip.salaryBasis && <span className="ml-2 text-slate-400">· Basis: {payslip.salaryBasis}</span>}
                  {payslip.isProrated && (
                    <span className="ml-2 text-amber-600 font-semibold">· Prorated ({payslip.proratedDays} days)</span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Employee & Bank Particulars */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 bg-slate-50 border border-slate-200 rounded text-[11px]">
              {[
                ['Employee Name', payslip.employee.employeeName],
                ['Employee ID', `#${payslip.employee.employeeId}`],
                ['Department', payslip.employee.department],
                ['Designation', payslip.employee.designation],
                ['Bank A/C', payslip.employee.bankAccount],
                ['Bank / IFSC', payslip.employee.ifsc],
                ['PAN Number', payslip.employee.pan],
                ['UAN Number', payslip.employee.uan],
              ].map(([label, val]) => (
                <div key={label}>
                  <span className="text-slate-500 font-medium">{label}:</span>{' '}
                  <span className="font-semibold text-slate-800">{val}</span>
                </div>
              ))}
            </div>

            {/* 3. Attendance Summary */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2.5 bg-slate-100 border border-slate-200 rounded text-center text-[11px] font-mono">
              {[
                ['Days in Month', payslip.attendance.totalDays, ''],
                ['Present (P)', payslip.attendance.presentDays, ''],
                ['Week Off (WO)', payslip.attendance.weekoffs, ''],
                ['Holidays (HLD)', payslip.attendance.holidays, ''],
                ['Loss of Pay', payslip.attendance.unpaidLeaves, 'text-rose-600 font-semibold'],
                ['Payable Days', payslip.attendance.payableDays, 'text-emerald-700 font-semibold'],
              ].map(([label, val, cls]) => (
                <div key={label as string}>
                  <div className={`text-[10px] text-slate-500 ${cls as string}`}>{label as string}</div>
                  <div className={`font-bold text-slate-800 ${cls as string}`}>{val as number}</div>
                </div>
              ))}
            </div>

            {/* 4. Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider flex justify-between">
                  <span>Earnings</span><span>Amount (₹)</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {payslip.earnings.map((e: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 flex justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{e.componentName}</span>
                      <span className="font-mono font-semibold text-slate-900">₹{e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-100 border-t-2 border-slate-300 px-3 py-2 flex justify-between font-bold text-xs text-slate-900">
                  <span>Total Earnings</span>
                  <span className="font-mono">₹{payslip.totals.totalEarnings.toLocaleString()}</span>
                </div>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-slate-800 text-white px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider flex justify-between">
                  <span>Deductions</span><span>Amount (₹)</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {payslip.deductions.map((d: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 flex justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{d.componentName}</span>
                      <span className="font-mono font-semibold text-rose-700">₹{d.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {payslip.deductions.length === 0 && (
                    <div className="px-3 py-4 text-center text-slate-400 text-[11px]">
                      No statutory or loan deductions.
                    </div>
                  )}
                </div>
                <div className="bg-slate-100 border-t-2 border-slate-300 px-3 py-2 flex justify-between font-bold text-xs text-rose-700">
                  <span>Total Deductions</span>
                  <span className="font-mono">₹{payslip.totals.totalDeductions.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 5. Net Pay */}
            <div className="p-4 bg-emerald-50 border-2 border-emerald-600 rounded flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-900">Net Salary Payable</div>
                <div className="text-xs text-emerald-800 mt-0.5 font-medium italic">
                  ({payslip.totals.netSalaryInWords})
                </div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-900 font-mono">
                ₹{payslip.totals.netSalary.toLocaleString()}
              </div>
            </div>

            {/* 6. Signatures */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-[11px] text-slate-500">
              <div>
                <div className="h-10 border-b border-slate-400 w-48 mb-1" />
                <div>Employee Signature</div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="h-10 border-b border-slate-400 w-48 mb-1" />
                <div>Authorised Signatory</div>
                <div className="text-[10px] text-slate-400">{payslip.organization.name}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
