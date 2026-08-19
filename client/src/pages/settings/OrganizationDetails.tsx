import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Building2, ArrowLeft, Save } from 'lucide-react';

export const OrganizationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [activeTab, setActiveTab] = useState<'details' | 'policy'>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [orgForm, setOrgForm] = useState({
    name: '',
    code: '',
    address: '',
    isActive: true,
  });

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/masters/overview');
        const orgs = res.data.organizations || [];
        const org = orgs.find((o: any) => o.id === parseInt(id || '0', 10));
        
        if (org) {
          setOrgForm({
            name: org.name,
            code: org.code || '',
            address: org.address || '',
            isActive: org.isActive !== false,
          });
        } else {
          showError('Not Found', 'Organization not found.');
          navigate('/settings?tab=company');
        }
      } catch (err) {
        showError('Error', 'Failed to load organization.');
      } finally {
        setLoading(false);
      }
    };
    
    if (id && id !== 'new') {
      fetchOrg();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name) {
      showError('Validation', 'Organization Name is required.');
      return;
    }

    try {
      setSaving(true);
      if (id === 'new') {
        await apiClient.post('/masters/organizations', orgForm);
        showSuccess('Created', 'Organization created successfully.');
      } else {
        await apiClient.put(`/masters/organizations/${id}`, { ...orgForm, id: parseInt(id!, 10) });
        showSuccess('Updated', 'Organization updated successfully.');
      }
      navigate('/settings?tab=company');
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save organization.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-muted)] text-xs font-data">Loading organization details...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/settings?tab=company')}
            className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--ink-muted)] transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-semibold text-[var(--ink)] flex items-center gap-2">
              <Building2 className="text-indigo-600" size={24} />
              {id === 'new' ? 'New Organization' : orgForm.name}
            </h1>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Manage organization details and overarching company policies.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-[var(--rule)] px-4">
          <button
            className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
              activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Organization Details
          </button>
          {id !== 'new' && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'policy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('policy')}
            >
              Company Policy
            </button>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Organization Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="input-field w-full text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Organization Code</label>
                  <input
                    type="text"
                    value={orgForm.code}
                    onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })}
                    placeholder="e.g. ACME"
                    className="input-field w-full font-data text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Registered Address</label>
                <textarea
                  value={orgForm.address}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                  placeholder="Full registered address"
                  className="input-field w-full text-sm min-h-[80px]"
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
                  onClick={() => navigate('/settings?tab=company')}
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
          )}

          {activeTab === 'policy' && (
            <div className="space-y-4 max-w-3xl text-sm">
              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Leave Application Rules</h4>
                <p className="text-[var(--ink-muted)] mb-4">Configure global constraints for employee leave applications across this organization.</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Advance Notice Required</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Minimum days in advance an employee must apply for leave.</span>
                    </div>
                    <input type="number" defaultValue={2} className="input-field w-24 text-center font-data" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Max Consecutive Leaves</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Maximum number of days an employee can take continuously.</span>
                    </div>
                    <input type="number" defaultValue={14} className="input-field w-24 text-center font-data" />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Probation & Confirmation</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Default Probation Period (Days)</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Standard probation length for new hires.</span>
                    </div>
                    <input type="number" defaultValue={90} className="input-field w-24 text-center font-data" />
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end">
                <button className="btn-primary py-2 px-6 flex items-center gap-2">
                  <Save size={16} /> Save Policies
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
