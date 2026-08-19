import React, { useState, useEffect } from 'react';
import { useOrganization } from '../../context/CompanyContext';

export interface EmployeeFormData {
  employeeId?: string;
  employeeName: string;
  phone: string;
  departmentId: string;
  designationId: string;
  reportingManagerId: string;
  branchId: string;
  weekoff: string;
  joiningDate: string;
  employmentType: string;
  bloodGroup: string;
  gender: string;
  attendanceType: string;
  maritalStatus: string;
  nationality: string;
  workEmail: string;
  personalEmail: string;
  hasProbation: boolean;
  probationDays: number;
  roleId: string;
  dateOfBirth: string;
  currentAddress: string;
  permanentAddress: string;
}

interface EmployeeFormProps {
  initialData?: Partial<EmployeeFormData>;
  lookups: any;
  onSubmit: (data: EmployeeFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ 
  initialData, 
  lookups, 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
  submitLabel = 'Save Employee'
}) => {
  const { currentBranch, branches } = useOrganization();
  
  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeId: '',
    employeeName: '',
    phone: '',
    departmentId: '',
    designationId: '',
    reportingManagerId: '',
    branchId: currentBranch?.id || '',
    weekoff: 'Sunday',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: '',
    bloodGroup: '',
    gender: '',
    attendanceType: 'Biometric',
    maritalStatus: '',
    nationality: '',
    workEmail: '',
    personalEmail: '',
    hasProbation: false,
    probationDays: 90,
    roleId: '',
    dateOfBirth: '',
    currentAddress: '',
    permanentAddress: '',
    ...initialData
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form id="employeeForm" onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Personal Details */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">1. Personal Details</h4>
        
        {/* Auto ID - only show if not editing an existing employee or if we want to show it always */}
        <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)] font-ui block">
              Employee Code &amp; ID
            </span>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              System-generated with branch prefix
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-[var(--gold-600)] px-2.5 py-1 rounded-[3px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
            {branches?.find((b: any) => String(b.id) === String(formData.branchId || currentBranch?.id))?.code || 'EMP#'}{formData.employeeId ? formData.employeeId : '00X (Auto)'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Full Legal Name *</label>
            <input type="text" required value={formData.employeeName} onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })} placeholder="e.g. Ramesh Patel" className="register-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Date of Birth</label>
            <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} className="register-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Gender</label>
            <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="register-input w-full">
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Blood Group</label>
            <select value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className="register-input w-full">
              <option value="">Select</option>
              <option value="A+">A+</option><option value="A-">A-</option>
              <option value="B+">B+</option><option value="B-">B-</option>
              <option value="O+">O+</option><option value="O-">O-</option>
              <option value="AB+">AB+</option><option value="AB-">AB-</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Marital Status</label>
            <select value={formData.maritalStatus} onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })} className="register-input w-full">
              <option value="">Select Status</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Nationality</label>
            <input type="text" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} placeholder="e.g. Indian" className="register-input w-full" />
          </div>
        </div>
      </section>

      {/* 2. Contact Details */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">2. Contact Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Phone Number</label>
            <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="9876543210" className="register-input w-full font-data" />
          </div>
          <div></div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Work Email</label>
            <input type="email" value={formData.workEmail} onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })} placeholder="work@company.com" className="register-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Personal Email</label>
            <input type="email" value={formData.personalEmail} onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })} placeholder="personal@gmail.com" className="register-input w-full" />
          </div>
        </div>
      </section>

      {/* 2.5 Addresses */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">3. Addresses</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Current Address</label>
            <textarea
              value={formData.currentAddress}
              onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
              placeholder="Full current address"
              className="register-input w-full min-h-[60px]"
            />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[var(--ink)]">Permanent Address</label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer">
                <input 
                  type="checkbox" 
                  className="accent-[var(--gold-500)]"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, permanentAddress: formData.currentAddress });
                    }
                  }}
                />
                Same as Current Address
              </label>
            </div>
            <textarea
              value={formData.permanentAddress}
              onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
              placeholder="Full permanent address"
              className="register-input w-full min-h-[60px]"
            />
          </div>
        </div>
      </section>

      {/* 4. Job Assignment */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">4. Job Assignment</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Branch / Site Location</label>
            <div className="register-input w-full bg-[var(--paper)] text-[var(--ink-muted)] flex items-center">
              {currentBranch?.name || 'All / Default HQ'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Employment Type</label>
            <select value={formData.employmentType} onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })} className="register-input w-full">
              <option value="">Select Type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Intern</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Department</label>
            <select value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })} className="register-input w-full">
              <option value="">Select Department</option>
              {lookups?.departments
                ?.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                .map((d: any) => (<option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Designation</label>
            <select value={formData.designationId} onChange={(e) => setFormData({ ...formData, designationId: e.target.value })} className="register-input w-full">
              <option value="">Select Designation</option>
              {lookups?.designations
                ?.filter((des: any) => !currentBranch?.id || String(des.branchId) === String(currentBranch.id))
                .map((des: any) => (<option key={des.designationId} value={des.designationId}>{des.designationName}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Reporting Manager</label>
            <select value={formData.reportingManagerId} onChange={(e) => setFormData({ ...formData, reportingManagerId: e.target.value })} className="register-input w-full">
              <option value="">None (Top Level)</option>
              {lookups?.managers
                ?.filter((m: any) => !currentBranch?.id || String(m.branchId) === String(currentBranch.id))
                .map((m: any) => (<option key={m.employeeId} value={m.employeeId}>{m.employeeName}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">User Role (Auto-create account)</label>
            <select value={formData.roleId} onChange={(e) => setFormData({ ...formData, roleId: e.target.value })} className="register-input w-full">
              <option value="">No Login Access</option>
              {lookups?.roles?.map((r: any) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </div>
        </div>
      </section>

      {/* 5. Employment Rules */}
      <section className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider border-b border-[var(--rule)] pb-1 mb-2">5. Employment Rules</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Joining Date</label>
            <input type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} className="register-input w-full font-data" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Weekly Off</label>
            <select value={formData.weekoff} onChange={(e) => setFormData({ ...formData, weekoff: e.target.value })} className="register-input w-full">
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Saturday">Saturday</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Attendance Type</label>
            <select value={formData.attendanceType} onChange={(e) => setFormData({ ...formData, attendanceType: e.target.value })} className="register-input w-full">
              <option value="Biometric">Biometric</option>
              <option value="Web">Web Clock-in</option>
              <option value="Face + Location">Face Recognition + Location</option>
              <option value="Geo-Fencing">Geo-Fencing (Location Restricted)</option>
              <option value="IP Restricted">IP Restricted (Office Network)</option>
              <option value="Manual">Manual</option>
              <option value="None">None</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[var(--ink)] mb-2">Probation Period?</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--ink)] cursor-pointer">
                <input type="radio" checked={formData.hasProbation === true} onChange={() => setFormData({ ...formData, hasProbation: true })} className="accent-[var(--gold-500)]" />
                Yes
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--ink)] cursor-pointer">
                <input type="radio" checked={formData.hasProbation === false} onChange={() => setFormData({ ...formData, hasProbation: false })} className="accent-[var(--gold-500)]" />
                No
              </label>
            </div>
            {formData.hasProbation && (
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">Probation Length (Days)</label>
                <input type="number" min="0" value={formData.probationDays} onChange={(e) => setFormData({ ...formData, probationDays: Number(e.target.value) })} className="register-input w-full font-data" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Buttons container - rendered in the parent to match design exactly, or here */}
      <div className="p-4 mt-6 border-t border-[var(--rule)] bg-[var(--paper)] shrink-0 flex items-center justify-end gap-2 -mx-5 -mb-5">
        <button type="button" onClick={onCancel} className="btn-outline cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-50 cursor-pointer">
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};
