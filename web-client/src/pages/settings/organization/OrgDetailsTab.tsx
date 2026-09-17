import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import {
  Save,
  Building2,
  Mail,
  Phone,
  Globe,
  Upload,
  X,
  FileText,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useOrgOutletContext } from './OrganizationShell';

interface EligibleAdmin {
  employeeId: number;
  employeeName: string;
  workEmail?: string;
  department?: string;
  designation?: string;
  branchName?: string;
}

export const OrgDetailsTab: React.FC = () => {
  const { id, isNew, orgForm, setOrgForm } = useOrgOutletContext();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<EligibleAdmin[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Load active employees for admin selection
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const res = await apiClient.get('/masters/eligible-admins');
        if (Array.isArray(res.data)) {
          setEmployees(res.data);
        }
      } catch (err) {
        console.error('Failed to load eligible admins', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, []);

  // Auto-derive Indian PAN from 15-character GSTIN (characters 3 to 12)
  const derivedPan = React.useMemo(() => {
    const raw = (orgForm.gstin || '').trim().toUpperCase();
    if (raw.length >= 12 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(raw)) {
      return raw.substring(2, 12);
    }
    return null;
  }, [orgForm.gstin]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please upload a valid image file (PNG, JPG, WEBP, or SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Logo file cannot exceed 5MB.');
      return;
    }

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = `/masters/organizations/upload-logo`;

      const res = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.logoUrl) {
        setOrgForm((prev) => ({ ...prev, logoUrl: res.data.logoUrl }));
        setLogoError(false);
        showSuccess('Uploaded', 'Organization logo uploaded successfully.');
      }
    } catch (err: any) {
      showError('Upload Failed', err.response?.data?.message || 'Could not upload logo.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setOrgForm((prev) => ({ ...prev, logoUrl: '' }));
    setLogoError(false);
  };

  const handleAdminSelect = (empIdStr: string) => {
    setOrgForm((prev) => ({
      ...prev,
      adminEmployeeId: empIdStr ? Number(empIdStr) : null,
    }));
  };

  const selectedAdmin = React.useMemo(() => {
    if (!orgForm.adminEmployeeId) return null;
    return employees.find((e) => e.employeeId === orgForm.adminEmployeeId) || null;
  }, [employees, orgForm.adminEmployeeId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name?.trim()) {
      showError('Validation', 'Organization Name is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: orgForm.name.trim(),
        code: orgForm.code?.trim() || null,
        address: orgForm.address?.trim() || null,
        email: orgForm.email?.trim() || null,
        phone: orgForm.phone?.trim() || null,
        website: orgForm.website?.trim() || null,
        gstin: orgForm.gstin?.trim()?.toUpperCase() || null,
        adminEmployeeId: orgForm.adminEmployeeId || null,
        logoUrl: orgForm.logoUrl?.trim() || null,
        primaryColor: orgForm.primaryColor || '#D97706',
        customDomain: orgForm.customDomain?.trim() || null,
        isActive: orgForm.isActive !== false,
      };

      if (isNew) {
        await apiClient.post('/masters/organizations', payload);
        showSuccess('Created', 'Organization created successfully.');
        navigate('/settings/organizations');
      } else {
        // `id` is the opaque PublicId (GUID) used in the URL
        await apiClient.put(`/masters/organizations/${id}`, payload);
        showSuccess('Updated', 'Organization updated successfully.');
      }
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-6">
      {/* 1. Identity & Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Identity</CardTitle>
          <CardDescription>Primary business name and official corporate branding.</CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <div>
            <Input
              label="Organization Legal Name"
              type="text"
              value={orgForm.name}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              placeholder="e.g. Setu Developers Ltd."
              required
              icon={<Building2 size={14} />}
              helperText="Official registered enterprise or entity name."
            />
          </div>

          {/* Logo Upload Dropzone / Control */}
          <div className="pt-2 border-t border-[var(--border)]">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Organization Brand Logo
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-dashed border-[var(--border)]">
              {/* Preview Box */}
              <div className="w-16 h-16 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                {orgForm.logoUrl && !logoError ? (
                  <img
                    src={orgForm.logoUrl}
                    alt="Logo Preview"
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <div className="flex flex-col items-center text-[var(--text-muted)] text-xs font-normal">
                    <Building2 size={22} className="mb-0.5 opacity-40" />
                    <span className="text-xs font-normal">No Logo</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Upload Actions */}
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary py-1.5 px-3 text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={13} />
                    {uploadingLogo ? 'Uploading...' : orgForm.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {orgForm.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="py-1.5 px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-[var(--radius-md)] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X size={13} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs font-normal text-[var(--text-muted)]">
                  PNG, JPG, WEBP, or SVG (max 5MB). Displayed across headers, reports, and tenant portals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Contact & Web Presence */}
      <Card>
        <CardHeader>
          <CardTitle>Contact & Web Presence</CardTitle>
          <CardDescription>Official communication channels for this organization tenant.</CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Corporate Email Address"
              type="email"
              value={orgForm.email || ''}
              onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
              placeholder="contact@company.com"
              icon={<Mail size={14} />}
              helperText="Official inquiries or administrative email."
            />
            <Input
              label="Primary Contact Number"
              type="tel"
              value={orgForm.phone || ''}
              onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
              placeholder="+91 98765 43210"
              icon={<Phone size={14} />}
              helperText="Corporate office telephone or support line."
            />
          </div>

          <div>
            <Input
              label="Official Website"
              type="url"
              value={orgForm.website || ''}
              onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
              placeholder="https://www.yourcompany.com"
              icon={<Globe size={14} />}
              helperText="Company public web portal or domain."
            />
          </div>
        </div>
      </Card>

      {/* 3. Statutory & Tax Information */}
      <Card>
        <CardHeader>
          <CardTitle>Statutory & Tax Information</CardTitle>
          <CardDescription>Registered corporate address and Indian tax identification credentials.</CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
              Registered Corporate Address
            </label>
            <textarea
              value={orgForm.address || ''}
              onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
              placeholder="Complete registered physical address as per statutory filings..."
              className="register-input w-full min-h-[72px] resize-y text-xs leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="GSTIN (Goods & Services Tax ID)"
                type="text"
                maxLength={15}
                value={orgForm.gstin || ''}
                onChange={(e) => setOrgForm({ ...orgForm, gstin: e.target.value.toUpperCase() })}
                placeholder="24AABCU9603R1ZM"
                icon={<FileText size={14} />}
                helperText="15-character alphanumeric statutory GSTIN."
              />
            </div>

            {/* Derived PAN Card */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                Corporate PAN (Permanent Account Number)
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] min-h-[38px]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className={derivedPan ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'} />
                  <span className="font-semibold text-xs text-[var(--text-primary)] tracking-wide">
                    {derivedPan || 'Auto-derived from GSTIN'}
                  </span>
                </div>
                {derivedPan && (
                  <span className="text-xs font-normal font-medium text-[var(--success)] bg-[var(--success-light)] px-1.5 py-0.5 rounded">
                    Derived from GSTIN
                  </span>
                )}
              </div>
              <p className="text-xs font-normal text-[var(--text-muted)] mt-1">
                Extracted automatically from characters 3–12 of GSTIN.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Primary Contact (Selected from Employee List) */}
      <Card>
        <CardHeader>
          <CardTitle>Primary Contact</CardTitle>
          <CardDescription>
            Designate an employee from the company roster as the primary contact person.
          </CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
              Select Primary Contact from Employees
            </label>
            <select
              value={orgForm.adminEmployeeId || ''}
              onChange={(e) => handleAdminSelect(e.target.value)}
              disabled={loadingEmployees}
              className="register-input w-full text-xs"
            >
              <option value="">-- No Primary Contact Assigned --</option>
              {employees.map((emp) => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.employeeName} (EMP#{String(emp.employeeId).padStart(3, '0')}{emp.designation ? ` • ${emp.designation}` : ''}{emp.department ? ` • ${emp.department}` : ''})
                </option>
              ))}
            </select>
            <p className="text-xs font-normal text-[var(--text-muted)] mt-1">
              Select any active employee from your organization roster.
            </p>
          </div>

          {/* Selected Admin Profile Preview Card */}
          {selectedAdmin && (
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-semibold text-xs uppercase shadow-xs">
                  {(selectedAdmin.employeeName || 'A').slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[var(--text-primary)]">
                      {selectedAdmin.employeeName}
                    </span>
                    <span className=" text-xs font-normal px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                      EMP#{String(selectedAdmin.employeeId).padStart(3, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-normal text-[var(--text-muted)] mt-0.5">
                    {selectedAdmin.workEmail && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {selectedAdmin.workEmail}
                      </span>
                    )}
                    {selectedAdmin.department && (
                      <span>• {selectedAdmin.department}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAdminSelect('')}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] px-2 py-1 rounded transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* 5. Sticky / Clean Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-xs">
        <button
          type="button"
          onClick={() => navigate('/settings/organizations')}
          className="btn-secondary py-2 px-4 text-sm font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary py-2 px-6 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving Organization...' : isNew ? 'Create Organization' : 'Save Organization'}
        </button>
      </div>
    </form>
  );
};
