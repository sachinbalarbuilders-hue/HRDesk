import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { MapPin, ArrowLeft, Save, Clock, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const BranchDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const parentOrgFromQuery = parseInt(searchParams.get('organizationId') || '0', 10);
  
  const [activeTab, setActiveTab] = useState<'details' | 'policy'>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  
  const [branchForm, setBranchForm] = useState({
    organizationId: 0,
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    whatsAppGroupId: '',
    allowedIPs: '',
    latitude: 21.1702,
    longitude: 72.8311,
    radiusMeters: 100,
    isActive: true,
  });

  const [policyForm, setPolicyForm] = useState({
    gracePeriodMinutes: 15,
    halfDayThresholdHours: 4.5,
    fullDayThresholdHours: 8.0,
    autoSyncIntervalMinutes: 5,
    defaultWeekoff: 'Sunday',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [overviewRes, policyRes] = await Promise.allSettled([
          apiClient.get('/masters/overview'),
          id && id !== 'add' ? apiClient.get('/masters/attendance-policy', { params: { branchId: id } }) : Promise.reject()
        ]);
        
        const orgs = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.organizations) || [];
        setOrganizations(orgs);
        
        if (id && id !== 'add') {
          const branches = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.branches) || [];
          const branch = branches.find((b: any) => b.id === parseInt(id, 10));
          
          if (branch) {
            setBranchForm({
              organizationId: branch.organizationId || (orgs.length > 0 ? orgs[0].id : 0),
              name: branch.name,
              code: branch.code || '',
              address: branch.address || '',
              city: branch.city || '',
              state: branch.state || '',
              pincode: branch.pincode || '',
              whatsAppGroupId: branch.whatsAppGroupId || '',
              allowedIPs: branch.allowedIPs || '',
              latitude: branch.latitude || 21.1702,
              longitude: branch.longitude || 72.8311,
              radiusMeters: branch.radiusMeters || 100,
              isActive: branch.isActive !== false,
            });
          } else {
            showError('Not Found', 'Branch not found.');
            navigate(parentOrgFromQuery ? `/settings/organizations/${parentOrgFromQuery}` : '/settings?tab=company');
          }

          if (policyRes.status === 'fulfilled' && policyRes.value.data) {
            const p = policyRes.value.data;
            setPolicyForm({
              gracePeriodMinutes: p.gracePeriodMinutes ?? 15,
              halfDayThresholdHours: p.halfDayThresholdHours ?? 4.5,
              fullDayThresholdHours: p.fullDayThresholdHours ?? 8.0,
              autoSyncIntervalMinutes: p.autoSyncIntervalMinutes ?? 5,
              defaultWeekoff: p.defaultWeekoff ?? 'Sunday',
            });
          }
        } else if (orgs.length > 0) {
           const presetOrg = parentOrgFromQuery > 0 && orgs.some((o: any) => o.id === parentOrgFromQuery)
             ? parentOrgFromQuery
             : orgs[0].id;
           setBranchForm(prev => ({ ...prev, organizationId: presetOrg }));
        }
      } catch (err) {
        showError('Error', 'Failed to load branch data.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name || !branchForm.organizationId) {
      showError('Validation', 'Branch Name and Organization are required.');
      return;
    }

    try {
      setSaving(true);
      if (id === 'add') {
        await apiClient.post('/masters/branches', branchForm);
        showSuccess('Created', 'Branch created successfully.');
      } else {
        await apiClient.put(`/masters/branches/${id}`, { ...branchForm, id: parseInt(id!, 10) });
        showSuccess('Updated', 'Branch updated successfully.');
      }
      navigate(`/settings/organizations/${branchForm.organizationId}`);
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || id === 'add') return;

    try {
      setSaving(true);
      await Promise.all([
        apiClient.put(`/masters/branches/${id}`, { ...branchForm, id: parseInt(id, 10) }),
        apiClient.put('/masters/attendance-policy', {
          ...policyForm,
          branchId: parseInt(id, 10),
        })
      ]);
      showSuccess('Saved', 'Branch attendance policies saved.');
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save policies.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-muted)] text-xs font-data">Loading branch details...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(branchForm.organizationId ? `/settings/organizations/${branchForm.organizationId}` : '/settings?tab=company')}
            className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--ink-muted)] transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-semibold text-[var(--ink)] flex items-center gap-2">
              <MapPin className="text-indigo-600" size={24} />
              {id === 'add' ? 'New Branch' : branchForm.name}
            </h1>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Manage branch details and local attendance rules.
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
            Branch Details
          </button>
          {id !== 'add' && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'policy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('policy')}
            >
              Attendance Policy
            </button>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column: Basic Details */}
                <div className="space-y-5">
                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Parent Organization <span className="text-rose-500">*</span></label>
                    {id === 'add' && parentOrgFromQuery <= 0 ? (
                      <select
                        value={branchForm.organizationId}
                        onChange={(e) => setBranchForm({ ...branchForm, organizationId: parseInt(e.target.value, 10) })}
                        className="input-field w-full text-sm"
                        required
                      >
                        <option value={0} disabled>Select Organization</option>
                        {organizations.map(org => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={organizations.find(org => org.id === branchForm.organizationId)?.name || ''}
                        className="input-field w-full text-sm bg-[var(--surface-sunken)] text-[var(--ink-muted)] cursor-not-allowed"
                        readOnly
                        disabled
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Branch Name <span className="text-rose-500">*</span></label>
                    <input type="text" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} className="input-field w-full text-sm" required />
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Full Address</label>
                    <input type="text" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} className="input-field w-full text-sm" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">City</label>
                      <input type="text" value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} className="input-field w-full text-sm" />
                    </div>
                    <div>
                      <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">State</label>
                      <input type="text" value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} className="input-field w-full text-sm" />
                    </div>
                    <div>
                      <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Pincode</label>
                      <input type="text" value={branchForm.pincode} onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })} className="input-field w-full font-data text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">WhatsApp Group ID</label>
                    <input type="text" value={branchForm.whatsAppGroupId} onChange={(e) => setBranchForm({ ...branchForm, whatsAppGroupId: e.target.value })} className="input-field w-full font-data text-sm" placeholder="Optional" />
                  </div>
                  
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={branchForm.isActive} onChange={(e) => setBranchForm({ ...branchForm, isActive: e.target.checked })} className="rounded border-[var(--rule)]" />
                      <span className="font-medium text-[var(--ink)] text-sm">Branch is Active</span>
                    </label>
                  </div>
                </div>

                {/* Right Column: IP & Geo */}
                <div className="space-y-6">
                  <div className="bg-[var(--surface-sunken)] p-4 rounded-md border border-[var(--rule)]">
                     <h4 className="font-semibold text-[13px] text-[var(--ink)] mb-3 flex items-center gap-2">
                       <Clock size={14} className="text-indigo-600" />
                       IP Restrictions (Web Clock-in)
                     </h4>
                     <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Allowed Office IPs</label>
                     <input
                       type="text"
                       value={branchForm.allowedIPs}
                       onChange={(e) => setBranchForm({ ...branchForm, allowedIPs: e.target.value })}
                       placeholder="e.g. 192.168.1.100, 203.0.113.50"
                       className="input-field w-full font-mono text-sm"
                     />
                     <span className="text-[10px] text-[var(--ink-muted)] block mt-1">Comma-separated list of IP addresses allowed. Leave blank for no restriction.</span>
                  </div>

                  <div className="bg-[var(--surface-sunken)] p-4 rounded-md border border-[var(--rule)]">
                     <h4 className="font-semibold text-[13px] text-[var(--ink)] mb-3 flex items-center gap-2">
                       <MapIcon size={14} className="text-indigo-600" />
                       Geofencing (Mobile App)
                     </h4>
                     <div className="grid grid-cols-3 gap-3 mb-3">
                       <div>
                         <label className="block font-medium text-[var(--ink)] mb-1 text-xs">Latitude</label>
                         <input type="number" step="0.0001" value={branchForm.latitude} onChange={(e) => setBranchForm({ ...branchForm, latitude: parseFloat(e.target.value) })} className="input-field w-full font-data text-xs" />
                       </div>
                       <div>
                         <label className="block font-medium text-[var(--ink)] mb-1 text-xs">Longitude</label>
                         <input type="number" step="0.0001" value={branchForm.longitude} onChange={(e) => setBranchForm({ ...branchForm, longitude: parseFloat(e.target.value) })} className="input-field w-full font-data text-xs" />
                       </div>
                       <div>
                         <label className="block font-medium text-[var(--ink)] mb-1 text-xs">Radius (m)</label>
                         <input type="number" value={branchForm.radiusMeters} onChange={(e) => setBranchForm({ ...branchForm, radiusMeters: parseInt(e.target.value) })} className="input-field w-full font-data text-xs" />
                       </div>
                     </div>
                     <div className="w-full h-[200px] bg-slate-100 rounded border border-[var(--rule)] overflow-hidden relative">
                        {(branchForm.latitude && branchForm.longitude) ? (
                          <MapContainer key={`${branchForm.latitude}-${branchForm.longitude}`} center={[branchForm.latitude, branchForm.longitude]} zoom={16} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={[branchForm.latitude, branchForm.longitude]} />
                            <Circle center={[branchForm.latitude, branchForm.longitude]} pathOptions={{ color: 'indigo', fillColor: 'indigo', fillOpacity: 0.2 }} radius={branchForm.radiusMeters || 100} />
                          </MapContainer>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[var(--ink-muted)] flex-col gap-2">
                            <MapPin size={24} className="opacity-20" />
                            <p className="text-[10px]">No valid GPS coordinates</p>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--rule)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(branchForm.organizationId ? `/settings/organizations/${branchForm.organizationId}` : '/settings?tab=company')}
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
                  {saving ? 'Saving...' : 'Save Branch'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'policy' && (
            <form onSubmit={handleSavePolicy} className="space-y-6 max-w-3xl">
              {/* Work Hours & Thresholds */}
              <div className="bg-[var(--surface-sunken)] p-5 rounded-lg border border-[var(--rule)] space-y-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-indigo-600" />
                  <h4 className="font-semibold text-[var(--ink)] text-sm">Working Hours & Late-In Rules</h4>
                </div>
                <p className="text-xs text-[var(--ink-muted)]">
                  Configure branch-specific grace periods and minimum hours for Present / Half-Day credit.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Grace Period for Late In (Minutes)</label>
                    <input
                      type="number"
                      value={policyForm.gracePeriodMinutes}
                      onChange={(e) => setPolicyForm({ ...policyForm, gracePeriodMinutes: Number(e.target.value) })}
                      className="input-field w-full text-xs font-data"
                      min={0}
                      max={120}
                    />
                    <p className="text-[10px] text-[var(--ink-muted)] mt-1">Punches within this buffer are marked On-Time.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Half-Day Threshold (Hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={policyForm.halfDayThresholdHours}
                      onChange={(e) => setPolicyForm({ ...policyForm, halfDayThresholdHours: Number(e.target.value) })}
                      className="input-field w-full text-xs font-data"
                      min={1}
                      max={12}
                    />
                    <p className="text-[10px] text-[var(--ink-muted)] mt-1">Work duration below this triggers Half-Day deduction.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Full-Day Working Hours Requirement</label>
                    <input
                      type="number"
                      step="0.5"
                      value={policyForm.fullDayThresholdHours}
                      onChange={(e) => setPolicyForm({ ...policyForm, fullDayThresholdHours: Number(e.target.value) })}
                      className="input-field w-full text-xs font-data"
                      min={1}
                      max={16}
                    />
                    <p className="text-[10px] text-[var(--ink-muted)] mt-1">Minimum productive hours for full Present credit.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Biometric Device Auto-Sync Frequency</label>
                    <select
                      value={policyForm.autoSyncIntervalMinutes}
                      onChange={(e) => setPolicyForm({ ...policyForm, autoSyncIntervalMinutes: Number(e.target.value) })}
                      className="input-field w-full text-xs"
                    >
                      <option value={1}>Every 1 Minute (High Precision)</option>
                      <option value={5}>Every 5 Minutes (Standard Recommended)</option>
                      <option value={15}>Every 15 Minutes</option>
                      <option value={30}>Every 30 Minutes</option>
                    </select>
                    <p className="text-[10px] text-[var(--ink-muted)] mt-1">Cloud sync frequency from biometric hardware.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary py-2 px-6 flex items-center gap-2">
                  <Save size={16} />
                  {saving ? 'Saving Policies...' : 'Save Branch Policies'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
