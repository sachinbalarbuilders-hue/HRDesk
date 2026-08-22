import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { MapPin, ArrowLeft, Save, Clock, Map as MapIcon, Search, Navigation, Loader2, Layers, Globe } from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Leaflet click handler component
const MapClickHandler: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const BranchDetails: React.FC = () => {
  // Both segments are opaque PublicIds (GUIDs): orgId identifies the parent
  // organization, branchId identifies the branch itself (or 'add' for a new branch).
  const { orgId: orgPublicId, branchId: id } = useParams<{ orgId: string; branchId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const parentOrgPublicId = orgPublicId || '';
  
  const [activeTab, setActiveTab] = useState<'details' | 'policy'>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  // Internal integer branch Id — needed for endpoints not yet migrated to PublicId
  // (e.g. attendance-policy, which is keyed by numeric branchId).
  const [branchId, setBranchId] = useState<number | null>(null);

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
    sandwichRuleEnabled: true,
  });

  const [mapMode, setMapMode] = useState<'streets' | 'satellite' | 'hybrid'>('satellite');
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<any[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  const handleSearchPlace = async (query: string) => {
    setPlaceQuery(query);
    if (!query || query.trim().length < 2) {
      setPlaceResults([]);
      return;
    }

    // 1. Check if user pasted Google Maps URL or raw "lat, lng" coordinates
    const urlMatch = query.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || query.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const coordMatch = urlMatch || query.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        setBranchForm((prev) => ({ ...prev, latitude: lat, longitude: lon }));
        setPlaceResults([]);
        showSuccess('GPS Coordinates Pinned', `Location set to ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        return;
      }
    }

    // 2. Dual Search: Nominatim + Photon Fuzzy POI Engine
    try {
      setSearchingPlace(true);
      const [nomRes, photonRes] = await Promise.allSettled([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`).then(r => r.json()),
        fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`).then(r => r.json())
      ]);

      const combined: any[] = [];
      const seen = new Set<string>();

      if (nomRes.status === 'fulfilled' && Array.isArray(nomRes.value)) {
        for (const item of nomRes.value) {
          const key = `${parseFloat(item.lat).toFixed(4)},${parseFloat(item.lon).toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined.push({
              display_name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              type: item.type || 'place'
            });
          }
        }
      }

      if (photonRes.status === 'fulfilled' && photonRes.value?.features) {
        for (const f of photonRes.value.features) {
          const [lon, lat] = f.geometry.coordinates;
          const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            const props = f.properties;
            const name = [props.name, props.street, props.city, props.state].filter(Boolean).join(', ');
            combined.push({
              display_name: name || props.name || 'Location',
              lat: lat.toString(),
              lon: lon.toString(),
              type: props.type || 'poi'
            });
          }
        }
      }

      setPlaceResults(combined);
    } catch (err) {
      console.error('Error searching place:', err);
    } finally {
      setSearchingPlace(false);
    }
  };

  const handleSelectPlace = (place: any) => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    setBranchForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
    }));
    setPlaceResults([]);
    setPlaceQuery(place.display_name);
    showSuccess('Location Selected', `Pinned to ${place.display_name.split(',')[0]}`);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showError('GPS Error', 'Geolocation is not supported by your browser.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBranchForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setLocatingUser(false);
        showSuccess('GPS Located', `Pinned at ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => {
        setLocatingUser(false);
        showError('GPS Error', 'Location permission denied or unavailable.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMapLocationSelect = (lat: number, lng: number) => {
    setBranchForm((prev) => ({
      ...prev,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6)),
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const overviewRes = await apiClient.get('/masters/overview').then(
          (res) => ({ status: 'fulfilled' as const, value: res }),
          (err) => ({ status: 'rejected' as const, reason: err })
        );

        const orgs = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.organizations) || [];
        setOrganizations(orgs);
        
        if (id && id !== 'add') {
          const branches = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.branches) || [];
          // The URL param is the opaque PublicId (GUID), not the internal integer Id.
          const branch = branches.find((b: any) => String(b.publicId) === id);
          
          if (branch) {
            setBranchId(branch.id);
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

            const policyRes = await apiClient.get('/masters/attendance-policy', { params: { branchId: branch.id } }).then(
              (res) => ({ status: 'fulfilled' as const, value: res }),
              (err) => ({ status: 'rejected' as const, reason: err })
            );
            if (policyRes.status === 'fulfilled' && policyRes.value.data) {
              const p = policyRes.value.data;
              setPolicyForm({
                gracePeriodMinutes: p.gracePeriodMinutes ?? 15,
                halfDayThresholdHours: p.halfDayThresholdHours ?? 4.5,
                fullDayThresholdHours: p.fullDayThresholdHours ?? 8.0,
                autoSyncIntervalMinutes: p.autoSyncIntervalMinutes ?? 5,
                defaultWeekoff: p.defaultWeekoff ?? 'Sunday',
                sandwichRuleEnabled: p.sandwichRuleEnabled ?? true,
              });
            }
          } else {
            showError('Not Found', 'Branch not found.');
            navigate(parentOrgPublicId ? `/settings/organizations/${parentOrgPublicId}` : '/settings/organizations');
          }
        } else if (orgs.length > 0) {
           const matchedByQuery = parentOrgPublicId && orgs.find((o: any) => String(o.publicId) === parentOrgPublicId);
           const presetOrg = matchedByQuery ? matchedByQuery.id : orgs[0].id;
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
        // `id` here is the opaque PublicId (GUID) used in the URL, not the internal integer Id.
        await apiClient.put(`/masters/branches/${id}`, branchForm);
        showSuccess('Updated', 'Branch updated successfully.');
      }
      navigate(parentOrgPublicId ? `/settings/organizations/${parentOrgPublicId}/branches` : '/settings/organizations');
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || id === 'add' || !branchId) return;

    try {
      setSaving(true);
      await Promise.all([
        apiClient.put(`/masters/branches/${id}`, branchForm),
        apiClient.put('/masters/attendance-policy', {
          ...policyForm,
          branchId,
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
            onClick={() => navigate(parentOrgPublicId ? `/settings/organizations/${parentOrgPublicId}/branches` : '/settings/organizations')}
            className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--ink-muted)] transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-semibold text-[var(--ink)] flex items-center gap-2">
              <MapPin className="text-[var(--gold-500)]" size={24} />
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
              activeTab === 'details' ? 'border-[var(--gold-500)] text-[var(--gold-500)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Branch Details
          </button>
          {id !== 'add' && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'policy' ? 'border-[var(--gold-500)] text-[var(--gold-500)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
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
                    {id === 'add' && !parentOrgPublicId ? (
                      <select
                        value={branchForm.organizationId}
                        onChange={(e) => setBranchForm({ ...branchForm, organizationId: parseInt(e.target.value, 10) })}
                        className="register-input w-full text-sm"
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
                        className="register-input w-full text-sm bg-[var(--surface-sunken)] text-[var(--ink-muted)] cursor-not-allowed"
                        readOnly
                        disabled
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Branch Name <span className="text-rose-500">*</span></label>
                    <input type="text" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} className="register-input w-full text-sm" required />
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Full Address</label>
                    <input type="text" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} className="register-input w-full text-sm" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">City</label>
                      <input type="text" value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} className="register-input w-full text-sm" />
                    </div>
                    <div>
                      <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">State</label>
                      <input type="text" value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} className="register-input w-full text-sm" />
                    </div>
                    <div>
                      <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Pincode</label>
                      <input type="text" value={branchForm.pincode} onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })} className="register-input w-full font-data text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">WhatsApp Group ID</label>
                    <input type="text" value={branchForm.whatsAppGroupId} onChange={(e) => setBranchForm({ ...branchForm, whatsAppGroupId: e.target.value })} className="register-input w-full font-data text-sm" placeholder="Optional" />
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
                       <Clock size={14} className="text-[var(--gold-500)]" />
                       IP Restrictions (Web Clock-in)
                     </h4>
                     <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Allowed Office IPs</label>
                     <input
                       type="text"
                       value={branchForm.allowedIPs}
                       onChange={(e) => setBranchForm({ ...branchForm, allowedIPs: e.target.value })}
                       placeholder="e.g. 192.168.1.100, 203.0.113.50"
                       className="register-input w-full font-mono text-sm"
                     />
                     <span className="text-[10px] text-[var(--ink-muted)] block mt-1">Comma-separated list of IP addresses allowed. Leave blank for no restriction.</span>
                  </div>

                  <div className="bg-[var(--surface-sunken)] p-4 rounded-md border border-[var(--rule)] space-y-3">
                     <div className="flex items-center justify-between">
                       <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                         <MapIcon size={13} className="text-[var(--gold-500)]" />
                         Geofencing
                       </h4>
                       <button
                         type="button"
                         onClick={handleLocateMe}
                         disabled={locatingUser}
                         className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--surface)] border border-[var(--rule)] hover:border-[var(--gold-500)] text-[var(--ink)] flex items-center gap-1.5 transition-colors cursor-pointer"
                       >
                         {locatingUser ? <Loader2 size={12} className="animate-spin text-[var(--gold-500)]" /> : <Navigation size={12} className="text-[var(--gold-500)]" />}
                         {locatingUser ? 'Locating...' : 'Current Location'}
                       </button>
                     </div>

                     {/* Clean Search Input */}
                     <div className="relative">
                       <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Search Location</label>
                       <div className="relative">
                         <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
                         <input
                           type="text"
                           value={placeQuery}
                           onChange={(e) => handleSearchPlace(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               e.preventDefault();
                               e.stopPropagation();
                               if (placeResults.length > 0) {
                                 handleSelectPlace(placeResults[0]);
                               } else if (placeQuery.trim().length >= 2) {
                                 handleSearchPlace(placeQuery);
                               }
                             }
                           }}
                           placeholder="Search address, city, or coordinates..."
                           className="register-input w-full !pl-9 text-xs"
                         />
                         {searchingPlace && (
                           <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[var(--gold-500)]" />
                         )}
                       </div>

                       {/* Autocomplete Results Dropdown */}
                       {placeResults.length > 0 && (
                         <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-xl max-h-48 overflow-y-auto">
                           {placeResults.map((place: any, idx: number) => (
                             <button
                               key={idx}
                               type="button"
                               onClick={() => handleSelectPlace(place)}
                               className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface-sunken)] border-b border-[var(--rule)]/40 last:border-0 flex items-start gap-2 text-[var(--ink)] transition-colors cursor-pointer"
                             >
                               <MapPin size={13} className="text-[var(--gold-500)] shrink-0 mt-0.5" />
                               <span className="truncate">{place.display_name}</span>
                             </button>
                           ))}
                         </div>
                       )}
                     </div>

                     <div className="grid grid-cols-3 gap-3">
                       <div>
                         <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Latitude</label>
                         <input type="number" step="0.000001" value={branchForm.latitude} onChange={(e) => setBranchForm({ ...branchForm, latitude: parseFloat(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="register-input w-full font-data text-xs" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Longitude</label>
                         <input type="number" step="0.000001" value={branchForm.longitude} onChange={(e) => setBranchForm({ ...branchForm, longitude: parseFloat(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="register-input w-full font-data text-xs" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Radius (m)</label>
                         <input type="number" value={branchForm.radiusMeters} onChange={(e) => setBranchForm({ ...branchForm, radiusMeters: parseInt(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="register-input w-full font-data text-xs" />
                       </div>
                     </div>

                     <div className="w-full h-[250px] bg-slate-100 rounded border border-[var(--rule)] overflow-hidden relative">
                        {/* Map Mode Layer Selector */}
                        <div className="absolute top-2 right-2 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-1 rounded-md shadow-md border border-[var(--rule)] flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setMapMode('streets')}
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                              mapMode === 'streets'
                                ? 'bg-[var(--gold-500)] text-white shadow-sm'
                                : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)]'
                            }`}
                          >
                            Street
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapMode('satellite')}
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1 ${
                              mapMode === 'satellite'
                                ? 'bg-[var(--gold-500)] text-white shadow-sm'
                                : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)]'
                            }`}
                          >
                            <Globe size={10} />
                            Satellite
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapMode('hybrid')}
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1 ${
                              mapMode === 'hybrid'
                                ? 'bg-[var(--gold-500)] text-white shadow-sm'
                                : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)]'
                            }`}
                          >
                            <Layers size={10} />
                            Hybrid
                          </button>
                        </div>

                        {(branchForm.latitude && branchForm.longitude) ? (
                          <MapContainer key={`${branchForm.latitude}-${branchForm.longitude}-${mapMode}`} center={[branchForm.latitude, branchForm.longitude]} zoom={16} style={{ height: '100%', width: '100%' }}>
                            {mapMode === 'streets' && (
                              <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; OpenStreetMap'
                              />
                            )}
                            {mapMode === 'satellite' && (
                              <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Tiles &copy; Esri"
                                maxZoom={19}
                              />
                            )}
                            {mapMode === 'hybrid' && (
                              <TileLayer
                                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                attribution="&copy; Google"
                                maxZoom={20}
                              />
                            )}
                            <MapClickHandler onLocationSelect={handleMapLocationSelect} />
                            <Marker position={[branchForm.latitude, branchForm.longitude]} />
                            <Circle
                              center={[branchForm.latitude, branchForm.longitude]}
                              pathOptions={{
                                color: mapMode === 'streets' ? '#4f46e5' : '#eab308',
                                fillColor: mapMode === 'streets' ? '#6366f1' : '#facc15',
                                fillOpacity: 0.25,
                                weight: 2
                              }}
                              radius={branchForm.radiusMeters || 100}
                            />
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
                  onClick={() => navigate(parentOrgPublicId ? `/settings/organizations/${parentOrgPublicId}/branches` : '/settings/organizations')}
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
                  <Clock size={16} className="text-[var(--gold-500)]" />
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
                      className="register-input w-full text-xs font-data"
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
                      className="register-input w-full text-xs font-data"
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
                      className="register-input w-full text-xs font-data"
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
                      className="register-input w-full text-xs"
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
