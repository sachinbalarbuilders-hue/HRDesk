import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { Save } from 'lucide-react';
import { useOrgOutletContext } from './OrganizationShell';

export const OrgDetailsTab: React.FC = () => {
  const { id, isNew, orgForm, setOrgForm } = useOrgOutletContext();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name) {
      showError('Validation', 'Organization Name is required.');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        await apiClient.post('/masters/organizations', orgForm);
        showSuccess('Created', 'Organization created successfully.');
        navigate('/settings/organizations');
      } else {
        // `id` here is the opaque PublicId (GUID) used in the URL, not the internal integer Id.
        await apiClient.put(`/masters/organizations/${id}`, orgForm);
        showSuccess('Updated', 'Organization updated successfully.');
      }
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Organization Name <span className="text-rose-500">*</span></label>
        <input
          type="text"
          value={orgForm.name}
          onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
          placeholder="e.g. Acme Corp"
          className="register-input w-full text-sm"
          required
        />
      </div>

      <div>
        <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Registered Address</label>
        <textarea
          value={orgForm.address}
          onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
          placeholder="Full registered address"
          className="register-input w-full text-sm min-h-[80px]"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer pt-2">
        <input
          type="checkbox"
          checked={orgForm.isActive}
          onChange={(e) => setOrgForm({ ...orgForm, isActive: e.target.checked })}
          className="rounded border-[var(--rule)]"
        />
        <span className="font-medium text-sm text-[var(--ink)]">Organization is Active</span>
      </label>

      <div className="pt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/settings/organizations')}
          className="btn-secondary py-2 px-4"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary py-2 px-6 flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Organization'}
        </button>
      </div>
    </form>
  );
};
