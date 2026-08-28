import React, { useState, useEffect } from 'react';
import { useOrganization } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { Clock } from 'lucide-react';

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
  contractDurationMonths?: number;
  contractEndDate?: string;
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
  // Bank account
  bankName: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankAccountHolderName: string;
  bankAccountType: string;
  // Statutory
  panNumber: string;
  aadhaarNumber: string;
  uanNumber: string;
  pfNumber: string;
  esiNumber: string;
  // Emergency contact
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  // Additional
  fatherOrSpouseName: string;
  passportNumber: string;
  noticePeriodDays?: number;
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
  const { isAdmin, getPermissionScope } = useAuth();

  const isEditing = Boolean(initialData?.employeeId);
  const editScope = getPermissionScope('Employees.Edit') || 'All Details';
  const isBasicInfoOnly = isEditing && !isAdmin && editScope === 'Basic Information';
  
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
    contractDurationMonths: undefined,
    contractEndDate: '',
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
    // Bank account
    bankName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankAccountHolderName: '',
    bankAccountType: '',
    // Statutory
    panNumber: '',
    aadhaarNumber: '',
    uanNumber: '',
    pfNumber: '',
    esiNumber: '',
    // Emergency contact
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    // Additional
    fatherOrSpouseName: '',
    passportNumber: '',
    noticePeriodDays: undefined,
    ...initialData
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  // Sync branchId from context once it resolves (handles case where currentBranch
  // wasn't available at first render, causing branchId to be saved as null)
  useEffect(() => {
    if (!isEditing && currentBranch?.id) {
      setFormData(prev => ({
        ...prev,
        // Only override if not already set (e.g. by initialData)
        branchId: prev.branchId || String(currentBranch.id),
      }));
    }
  }, [currentBranch?.id, isEditing]);

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
            {(() => {
              const branch = branches?.find((b: any) => String(b.id) === String(formData.branchId || currentBranch?.id));
              const rawPrefix = branch?.code || 'EMP#';
              const prefix = (rawPrefix.endsWith('#') || rawPrefix.endsWith('-') || rawPrefix.endsWith('_') || rawPrefix.endsWith('/'))
                ? rawPrefix
                : `${rawPrefix}#`;
              const num = formData.employeeId ? String(formData.employeeId).padStart(3, '0') : '00X (Auto)';
              return `${prefix}${num}`;
            })()}
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
              <option value="Non-Binary">Non-Binary</option>
              <option value="Transgender">Transgender</option>
              <option value="Undisclosed">Prefer not to say</option>
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
              <option value="Separated">Separated</option>
              <option value="Domestic Partner">Domestic Partner</option>
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[var(--ink)]">Work Email</label>
              {isBasicInfoOnly && (
                <span className="text-[10px] text-[var(--ink-muted)]">🔒 Corporate</span>
              )}
            </div>
            <input 
              disabled={isBasicInfoOnly}
              type="email" 
              value={formData.workEmail} 
              onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })} 
              placeholder="work@company.com" 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`} 
            />
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
        <div className="flex items-center justify-between border-b border-[var(--rule)] pb-1 mb-2">
          <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">4. Job Assignment</h4>
          {isBasicInfoOnly && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
              🔒 Locked (Basic Info Edit Scope)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Branch / Site Location</label>
            <div className="register-input w-full bg-[var(--paper)] text-[var(--ink-muted)] flex items-center">
              {currentBranch?.name || 'All / Default HQ'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Employment Type</label>
            <select 
              disabled={isBasicInfoOnly} 
              value={formData.employmentType} 
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
              <option value="">Select Type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Intern</option>
            </select>
          </div>

          {/* Dynamic Contract / Internship Term Section */}
          {(formData.employmentType === 'Contract' || formData.employmentType === 'Intern') && (
            <div className="col-span-2 p-3.5 bg-[var(--surface-sunken)]/70 rounded-[var(--radius-md)] border border-[var(--gold-500)]/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock size={14} />
                  {formData.employmentType === 'Contract' ? 'Contract Agreement Duration' : 'Internship Term Duration'}
                </span>
                <span className="text-[10px] text-[var(--ink-muted)]">Fixed-term arrangement</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Duration (Months)
                  </label>
                  <select
                    disabled={isBasicInfoOnly}
                    value={formData.contractDurationMonths || ''}
                    onChange={(e) => {
                      const months = e.target.value ? Number(e.target.value) : undefined;
                      let newEndDate = formData.contractEndDate;
                      if (months && formData.joiningDate) {
                        const d = new Date(formData.joiningDate);
                        d.setMonth(d.getMonth() + months);
                        newEndDate = d.toISOString().split('T')[0];
                      }
                      setFormData({
                        ...formData,
                        contractDurationMonths: months,
                        contractEndDate: newEndDate,
                      });
                    }}
                    className={`register-input w-full font-data ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
                  >
                    <option value="">Select Duration</option>
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months (Standard)</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months (1 Year)</option>
                    <option value="24">24 Months (2 Years)</option>
                    <option value="36">36 Months (3 Years)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    {formData.employmentType === 'Contract' ? 'Contract End Date' : 'Internship Completion Date'}
                  </label>
                  <input
                    disabled={isBasicInfoOnly}
                    type="date"
                    value={formData.contractEndDate ? formData.contractEndDate.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                    className={`register-input w-full font-data ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Department</label>
            <select 
              disabled={isBasicInfoOnly}
              value={formData.departmentId} 
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
              <option value="">Select Department</option>
              {lookups?.departments
                ?.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                .map((d: any) => (<option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Designation</label>
            <select 
              disabled={isBasicInfoOnly}
              value={formData.designationId} 
              onChange={(e) => setFormData({ ...formData, designationId: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
              <option value="">Select Designation</option>
              {lookups?.designations
                ?.filter((des: any) => !currentBranch?.id || String(des.branchId) === String(currentBranch.id))
                .map((des: any) => (<option key={des.designationId} value={des.designationId}>{des.designationName}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Reporting Manager</label>
            <select 
              disabled={isBasicInfoOnly}
              value={formData.reportingManagerId} 
              onChange={(e) => setFormData({ ...formData, reportingManagerId: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
              <option value="">None (Top Level)</option>
              {lookups?.managers
                ?.filter((m: any) => !currentBranch?.id || String(m.branchId) === String(currentBranch.id))
                .map((m: any) => (<option key={m.employeeId} value={m.employeeId}>{m.employeeName}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">User Role (Auto-create account)</label>
            <select 
              disabled={isBasicInfoOnly}
              value={formData.roleId} 
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
              <option value="">No Login Access</option>
              {lookups?.roles?.map((r: any) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
            {formData.roleId && (
              <p className="text-[10px] text-[var(--gold-600)] dark:text-[var(--gold-400)] mt-1 font-medium">
                ✨ Auto-creates corporate login using Work Email with initial password <code>Welcome@123</code>.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 5. Employment Rules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--rule)] pb-1 mb-2">
          <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">5. Employment Rules</h4>
          {isBasicInfoOnly && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
              🔒 Locked (Basic Info Edit Scope)
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Joining Date</label>
            <input 
              disabled={isBasicInfoOnly}
              type="date" 
              value={formData.joiningDate} 
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} 
              className={`register-input w-full font-data ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`} 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Weekly Off</label>
            <select 
              disabled={isBasicInfoOnly}
              value={formData.weekoff} 
              onChange={(e) => setFormData({ ...formData, weekoff: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Attendance Type</label>
            <select 
              disabled={isBasicInfoOnly}
              value={formData.attendanceType} 
              onChange={(e) => setFormData({ ...formData, attendanceType: e.target.value })} 
              className={`register-input w-full ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`}
            >
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
              <label className={`flex items-center gap-1.5 text-xs text-[var(--ink)] ${isBasicInfoOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input 
                  disabled={isBasicInfoOnly}
                  type="radio" 
                  checked={formData.hasProbation === true} 
                  onChange={() => setFormData({ ...formData, hasProbation: true })} 
                  className="accent-[var(--gold-500)]" 
                />
                Yes
              </label>
              <label className={`flex items-center gap-1.5 text-xs text-[var(--ink)] ${isBasicInfoOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input 
                  disabled={isBasicInfoOnly}
                  type="radio" 
                  checked={formData.hasProbation === false} 
                  onChange={() => setFormData({ ...formData, hasProbation: false })} 
                  className="accent-[var(--gold-500)]" 
                />
                No
              </label>
            </div>
            {formData.hasProbation && (
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">Probation Length (Days)</label>
                <input 
                  disabled={isBasicInfoOnly}
                  type="number" 
                  min="0" 
                  value={formData.probationDays} 
                  onChange={(e) => setFormData({ ...formData, probationDays: Number(e.target.value) })} 
                  className={`register-input w-full font-data ${isBasicInfoOnly ? 'opacity-60 cursor-not-allowed bg-[var(--surface-sunken)]' : ''}`} 
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Bank Account Details */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--ink)] font-ui border-b border-[var(--rule)] pb-2">Bank Account</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="register-label">Bank Name</label>
            <input value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g. State Bank of India" className="register-input w-full" />
          </div>
          <div>
            <label className="register-label">Account Number</label>
            <input value={formData.bankAccountNumber} onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })} placeholder="e.g. 1234567890123" className="register-input w-full font-data" />
          </div>
          <div>
            <label className="register-label">IFSC Code</label>
            <input value={formData.bankIfscCode} onChange={(e) => setFormData({ ...formData, bankIfscCode: e.target.value.toUpperCase() })} placeholder="e.g. SBIN0001234" maxLength={11} className="register-input w-full font-data uppercase" />
          </div>
          <div>
            <label className="register-label">Account Holder Name</label>
            <input value={formData.bankAccountHolderName} onChange={(e) => setFormData({ ...formData, bankAccountHolderName: e.target.value })} placeholder="As per bank records" className="register-input w-full" />
          </div>
          <div>
            <label className="register-label">Account Type</label>
            <select value={formData.bankAccountType} onChange={(e) => setFormData({ ...formData, bankAccountType: e.target.value })} className="register-input w-full">
              <option value="">Select</option>
              <option value="Savings">Savings</option>
              <option value="Current">Current</option>
              <option value="Salary">Salary</option>
            </select>
          </div>
        </div>
      </section>

      {/* 6. Statutory Details */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--ink)] font-ui border-b border-[var(--rule)] pb-2">Statutory & Compliance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="register-label">PAN Number</label>
            <input value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} placeholder="e.g. ABCDE1234F" maxLength={10} className="register-input w-full font-data uppercase" />
          </div>
          <div>
            <label className="register-label">Aadhaar Number</label>
            <input value={formData.aadhaarNumber} onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 123456789012" maxLength={12} className="register-input w-full font-data" />
          </div>
          <div>
            <label className="register-label">UAN (Universal Account Number)</label>
            <input value={formData.uanNumber} onChange={(e) => setFormData({ ...formData, uanNumber: e.target.value })} placeholder="e.g. 100123456789" className="register-input w-full font-data" />
          </div>
          <div>
            <label className="register-label">PF Number</label>
            <input value={formData.pfNumber} onChange={(e) => setFormData({ ...formData, pfNumber: e.target.value })} placeholder="e.g. BGBNG/12345/0001234" className="register-input w-full font-data" />
          </div>
          <div>
            <label className="register-label">ESI Number</label>
            <input value={formData.esiNumber} onChange={(e) => setFormData({ ...formData, esiNumber: e.target.value })} placeholder="e.g. 3100123456" className="register-input w-full font-data" />
          </div>
        </div>
      </section>

      {/* 7. Emergency Contact */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--ink)] font-ui border-b border-[var(--rule)] pb-2">Emergency Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="register-label">Contact Name</label>
            <input value={formData.emergencyContactName} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} placeholder="Full name" className="register-input w-full" />
          </div>
          <div>
            <label className="register-label">Relationship</label>
            <select value={formData.emergencyContactRelation} onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })} className="register-input w-full">
              <option value="">Select</option>
              <option value="Spouse">Spouse</option>
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Brother">Brother</option>
              <option value="Sister">Sister</option>
              <option value="Friend">Friend</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="register-label">Phone</label>
            <input value={formData.emergencyContactPhone} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} placeholder="+91 9876543210" className="register-input w-full font-data" />
          </div>
        </div>
      </section>

      {/* 8. Additional Info */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--ink)] font-ui border-b border-[var(--rule)] pb-2">Additional Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="register-label">Father/Spouse Name</label>
            <input value={formData.fatherOrSpouseName} onChange={(e) => setFormData({ ...formData, fatherOrSpouseName: e.target.value })} placeholder="Full name" className="register-input w-full" />
          </div>
          <div>
            <label className="register-label">Passport Number</label>
            <input value={formData.passportNumber} onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value.toUpperCase() })} placeholder="e.g. A1234567" className="register-input w-full font-data uppercase" />
          </div>
          <div>
            <label className="register-label">Notice Period (days)</label>
            <input type="number" min="0" value={formData.noticePeriodDays || ''} onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value ? Number(e.target.value) : undefined })} placeholder="e.g. 30" className="register-input w-full font-data" />
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
