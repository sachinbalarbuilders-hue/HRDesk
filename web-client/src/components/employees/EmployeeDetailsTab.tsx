import React from 'react';
import { MapPin, Phone } from 'lucide-react';

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

interface Props {
  employee: any;
}

const Field = ({ label, value, className = '', titleAttr }: { label: string; value: React.ReactNode; className?: string; titleAttr?: string }) => (
  <div className={`p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] ${className}`}>
    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">{label}</span>
    <p className="font-semibold text-[var(--ink)] mt-0.5 truncate" title={titleAttr}>{value || '-'}</p>
  </div>
);

export const EmployeeDetailsTab: React.FC<Props> = ({ employee }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Main info grid */}
      <div className="grid grid-cols-2 gap-3 md:col-span-2">
        <Field label="Department"       value={employee.department   || 'Unassigned'} />
        <Field label="Designation"      value={employee.designation  || 'Staff Member'} />
        <Field label="Reporting Manager" value={employee.reportingManager || 'None'} />
        <Field label="Weekly Off"       value={employee.weekoff      || 'Sunday'} />
        <Field label="Employment Type"  value={employee.employmentType} />
        <Field label="Attendance Type"  value={employee.attendanceType} />
        <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
          <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Date of Birth</span>
          <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{formatDate(employee.dateOfBirth)}</p>
        </div>
        <Field label="Gender"         value={employee.gender} />
        <Field label="Blood Group"    value={employee.bloodGroup} />
        <Field label="Marital Status" value={employee.maritalStatus} />
        <Field label="Nationality"    value={employee.nationality} />
        <Field label="Work Email"     value={employee.workEmail}    className="overflow-hidden" titleAttr={employee.workEmail} />
        <Field label="Personal Email" value={employee.personalEmail} className="overflow-hidden" titleAttr={employee.personalEmail} />
      </div>

      {/* Addresses */}
      <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
        <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Current Address</span>
        <p className="font-semibold text-[var(--ink)] mt-0.5 whitespace-pre-wrap">{employee.currentAddress || '-'}</p>
      </div>
      <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
        <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Permanent Address</span>
        <p className="font-semibold text-[var(--ink)] mt-0.5 whitespace-pre-wrap">{employee.permanentAddress || '-'}</p>
      </div>

      {/* Probation + Branch + Contract Details */}
      <div className="grid grid-cols-2 gap-3 md:col-span-2">
        <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
          <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Probation Details</span>
          <p className="font-semibold text-[var(--ink)] mt-0.5">
            {employee.hasProbation ? `Yes, ${employee.probationDays} days` : 'No Probation'}
          </p>
        </div>
        <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Assigned Branch</span>
            <MapPin size={13} className="text-[var(--gold-500)]" />
          </div>
          <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.branch || 'No Branch Assigned'}</p>
        </div>

        {(employee.employmentType === 'Contract' || employee.employmentType === 'Intern' || employee.contractDurationMonths || employee.contractEndDate) && (
          <div className="p-4 rounded-[4px] bg-[var(--surface-sunken)]/60 border border-[var(--gold-500)]/30 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--gold-600)] dark:text-[var(--gold-400)] font-ui">
                {employee.employmentType === 'Contract' ? 'Contract Term' : 'Internship Term'}
              </span>
              <p className="font-semibold text-[var(--ink)] mt-0.5">
                {employee.contractDurationMonths ? `${employee.contractDurationMonths} Months` : 'Fixed Term'}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--gold-600)] dark:text-[var(--gold-400)] font-ui">
                {employee.employmentType === 'Contract' ? 'Contract Expiry Date' : 'Completion Date'}
              </span>
              <p className="font-data font-semibold text-[var(--ink)] mt-0.5">
                {formatDate(employee.contractEndDate)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Phone */}
      <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between md:col-span-2">
        <div>
          <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Phone Number</span>
          <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{employee.phone || '-'}</p>
        </div>
        <Phone size={16} className="text-[var(--ink-muted)]" />
      </div>

      {/* Bank Account Details */}
      {(employee.bankName || employee.bankAccountNumber || employee.bankIfscCode) && (
        <div className="md:col-span-2">
          <h3 className="text-[11px] uppercase font-bold text-[var(--ink-muted)] font-ui mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal-500)]"></span>
            Bank Account
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Bank Name" value={employee.bankName} />
            <Field label="Account Number" value={employee.bankAccountNumber ? `••••${employee.bankAccountNumber.slice(-4)}` : null} titleAttr={employee.bankAccountNumber} />
            <Field label="IFSC Code" value={employee.bankIfscCode} />
            <Field label="Account Holder" value={employee.bankAccountHolderName} />
            <Field label="Account Type" value={employee.bankAccountType} />
          </div>
        </div>
      )}

      {/* Statutory / Compliance */}
      {(employee.panNumber || employee.aadhaarNumber || employee.uanNumber || employee.pfNumber || employee.esiNumber) && (
        <div className="md:col-span-2">
          <h3 className="text-[11px] uppercase font-bold text-[var(--ink-muted)] font-ui mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-500)]"></span>
            Statutory Details
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {employee.panNumber && <Field label="PAN Number" value={employee.panNumber} />}
            {employee.aadhaarNumber && <Field label="Aadhaar Number" value={`••••${employee.aadhaarNumber.slice(-4)}`} titleAttr={employee.aadhaarNumber} />}
            {employee.uanNumber && <Field label="UAN (EPFO)" value={employee.uanNumber} />}
            {employee.pfNumber && <Field label="PF Number" value={employee.pfNumber} />}
            {employee.esiNumber && <Field label="ESI Number" value={employee.esiNumber} />}
          </div>
        </div>
      )}

      {/* Emergency Contact */}
      {(employee.emergencyContactName || employee.emergencyContactPhone || employee.emergencyContacts) && (
        <div className="md:col-span-2">
          <h3 className="text-[11px] uppercase font-bold text-[var(--ink-muted)] font-ui mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--rose-500)]"></span>
            Emergency Contacts
          </h3>
          {(() => {
            // Support both old single-field format and new JSON array format
            let contacts: {name?: string; relation?: string; phone?: string}[] = [];
            if (employee.emergencyContacts) {
              try { contacts = JSON.parse(employee.emergencyContacts); } catch { contacts = []; }
            }
            if (contacts.length === 0 && (employee.emergencyContactName || employee.emergencyContactPhone)) {
              contacts = [{ name: employee.emergencyContactName, relation: employee.emergencyContactRelation, phone: employee.emergencyContactPhone }];
            }
            return (
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3">
                    <Field label="Contact Name" value={c.name} />
                    <Field label="Relationship" value={c.relation} />
                    <Field label="Phone" value={c.phone} />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Additional Identity */}
      {(employee.passportNumber || employee.noticePeriodDays) && (
        <div className="md:col-span-2">
          <h3 className="text-[11px] uppercase font-bold text-[var(--ink-muted)] font-ui mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-muted)]"></span>
            Additional Information
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {employee.passportNumber && <Field label="Passport Number" value={employee.passportNumber} />}
            {employee.noticePeriodDays && <Field label="Notice Period" value={`${employee.noticePeriodDays} days`} />}
          </div>
        </div>
      )}
    </div>
  );
};
