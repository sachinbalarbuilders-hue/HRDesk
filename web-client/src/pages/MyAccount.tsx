import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { EmployeeMultiSelect } from '../components/ui/EmployeeMultiSelect';
import { Avatar } from '../components/ui/Avatar';
import { ChangePasswordTab } from './settings/ChangePasswordTab';
import { SlidersHorizontal, Calendar, Clock, Globe, DollarSign, Smartphone, Laptop, ShieldCheck, CheckCircle2, Download } from 'lucide-react';

const DEVICE_COLORS = [
  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
];

const getDeviceColor = (deviceName: string) => {
  let hash = 0;
  for (let i = 0; i < deviceName.length; i++) {
    hash = deviceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEVICE_COLORS[Math.abs(hash) % DEVICE_COLORS.length];
};

export const MyAccount: React.FC = () => {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState('general');

  // General Settings State
  const [globalPageSize, setGlobalPageSize] = useState(() => Number(localStorage.getItem('hrdesk_default_page_size')) || 20);
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('hrdesk_date_format') || 'DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState(() => localStorage.getItem('hrdesk_time_format') || '12-Hour');
  const [timeZone, setTimeZone] = useState(() => localStorage.getItem('hrdesk_time_zone') || 'Asia/Kolkata (UTC+05:30)');
  const [currency, setCurrency] = useState(() => localStorage.getItem('hrdesk_currency') || 'INR');
  const [allowedExportIds, setAllowedExportIds] = useState<number[]>([]);
  const [allowedExportEmployees, setAllowedExportEmployees] = useState<any[]>([]);

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const response = await apiClient.get('/settings/global');
        if (response.data) {
          if (response.data.timeZone) {
            setTimeZone(response.data.timeZone);
            localStorage.setItem('hrdesk_time_zone', response.data.timeZone);
          }
          if (response.data.allowedExportEmployeeIds) {
            setAllowedExportIds(response.data.allowedExportEmployeeIds);
          }
          if (response.data.allowedExportEmployees) {
            setAllowedExportEmployees(response.data.allowedExportEmployees);
          }
        }
      } catch (err) {
        console.error('Failed to load global timezone settings', err);
      }
    };
    fetchGlobalSettings();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await apiClient.get('/auth/sessions');
      setSessions(response.data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'devices') {
      fetchSessions();
    }
  }, [activeTab]);

  const handleRevokeSession = async (id: number) => {
    try {
      await apiClient.post(`/auth/sessions/revoke/${id}`);
      showSuccess('Session Revoked', 'The device has been logged out.');
      fetchSessions();
    } catch (err) {
      console.error('Failed to revoke session', err);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Are you sure you want to log out of all other devices?")) return;
    try {
      await apiClient.post('/auth/sessions/revoke-all');
      showSuccess('Sessions Revoked', 'All other devices have been logged out.');
      fetchSessions();
    } catch (err) {
      console.error('Failed to revoke all sessions', err);
    }
  };

  const handleGlobalSettingChange = async (key: string, value: string, setter: (val: string) => void, settingName: string) => {
    setter(value);
    localStorage.setItem(key, value);
    
    if (key === 'hrdesk_time_zone') {
      try {
        await apiClient.put('/settings/global', { timeZone: value });
      } catch (err) {
        console.error('Failed to save global timezone', err);
      }
    }
    
    showSuccess('Settings Saved', `${settingName} updated successfully.`);
    setTimeout(() => window.location.reload(), 600); // Reload to apply across app
  };

  const handleGlobalPageSizeChange = (val: string) => {
    const size = parseInt(val, 10);
    setGlobalPageSize(size);
    localStorage.setItem('hrdesk_default_page_size', size.toString());
    showSuccess('Settings Saved', `Default table row limit set to ${size}. This will apply as you navigate.`);
  };

  const handleAllowedExportChange = async (ids: number[], employees: any[]) => {
    setAllowedExportIds(ids);
    setAllowedExportEmployees(employees);
    try {
      await apiClient.put('/settings/global', { allowedExportEmployeeIds: ids });
      showSuccess('Settings Saved', 'Export permissions updated successfully.');
    } catch (err) {
      console.error('Failed to update export permissions', err);
      showError('Update Failed', 'Could not save export permissions.');
    }
  };

  return (
    <PageContainer>
      {/* Custom Profile Header */}
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-full shadow-sm border border-[var(--border-strong)] bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden shrink-0">
          <Avatar name={user?.fullName || user?.username || 'U'} size="lg" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{user?.fullName || user?.username}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm font-medium text-[var(--text-secondary)]">{user?.workEmail || user?.email}</p>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-primary)] text-[11px] font-semibold uppercase tracking-wider border border-[var(--border)]">
              <ShieldCheck size={12} className="text-[var(--accent)]" />
              {user?.roleName || 'User'}
            </div>
          </div>
        </div>
      </div>


      <Tabs
        tabs={[
          { id: 'general', label: 'General Settings' },
          { id: 'security', label: 'Security & Password' },
          { id: 'devices', label: 'My Devices' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="mt-6">
        {activeTab === 'general' && (
          <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Display & Region Preferences</CardTitle>
                <CardDescription>These settings affect how data is displayed to you across the entire platform.</CardDescription>
              </CardHeader>
              <div className="p-6 space-y-8">
                {/* Row Limit */}
                <div className="space-y-2 max-w-md">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SlidersHorizontal size={16} className="text-[var(--text-secondary)]" />
                    <label className="text-sm font-semibold text-[var(--text-primary)]">DataTable Row Limit</label>
                  </div>
                  <SearchableSelect
                    value={globalPageSize.toString()}
                    onChange={(val) => handleGlobalPageSizeChange(val)}
                    options={['10', '20', '50', '100', '200']}
                    searchable={false}
                    className="w-full"
                  />
                  <p className="text-xs text-[var(--text-muted)] pt-0.5">
                    Controls how many rows appear per page in all data tables.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[var(--border)]">
                  {/* Date Format */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar size={16} className="text-[var(--text-secondary)]" />
                      <label className="text-sm font-semibold text-[var(--text-primary)]">Date Format</label>
                    </div>
                    <SearchableSelect
                      value={dateFormat}
                      onChange={(val) => handleGlobalSettingChange('hrdesk_date_format', val, setDateFormat, 'Date Format')}
                      options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY']}
                      searchable={false}
                      className="w-full"
                    />
                  </div>

                  {/* Platform Export Permissions (Admins Only) */}
                  {(user?.isPlatformUser || user?.role === 'Admin') && (
                    <div className="space-y-2 col-span-1 md:col-span-2 mt-4 pt-4 border-t border-[var(--border-strong)]">
                      <div className="flex flex-col gap-1.5 mb-3">
                        <div className="flex items-center gap-2">
                          <Download size={16} className="text-[var(--text-secondary)]" />
                          <label className="text-sm font-semibold text-[var(--text-primary)]">Export & Import Permissions</label>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] max-w-2xl">
                          Select which employees are allowed to use Data Import/Export features across the platform. If empty, export is disabled for all standard employees.
                        </p>
                      </div>
                      <EmployeeMultiSelect
                        selectedIds={allowedExportIds}
                        selectedEmployees={allowedExportEmployees}
                        onChange={handleAllowedExportChange}
                        label="Allowed Employees"
                      />
                    </div>
                  )}

                  {/* Time Format */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock size={16} className="text-[var(--text-secondary)]" />
                      <label className="text-sm font-semibold text-[var(--text-primary)]">Time Format</label>
                    </div>
                    <SearchableSelect
                      value={timeFormat}
                      onChange={(val) => handleGlobalSettingChange('hrdesk_time_format', val, setTimeFormat, 'Time Format')}
                      options={[
                        { value: '12-Hour', label: '12-Hour (AM/PM)' },
                        { value: '24-Hour', label: '24-Hour' }
                      ]}
                      searchable={false}
                      className="w-full"
                    />
                  </div>

                  {/* Time Zone */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Globe size={16} className="text-[var(--text-secondary)]" />
                      <label className="text-sm font-semibold text-[var(--text-primary)]">Time Zone</label>
                    </div>
                    <SearchableSelect
                      value={timeZone}
                      onChange={(val) => handleGlobalSettingChange('hrdesk_time_zone', val, setTimeZone, 'Time Zone')}
                      options={[
                        'Pacific/Midway (UTC-11:00)',
                        'Pacific/Honolulu (UTC-10:00)',
                        'America/Anchorage (UTC-09:00)',
                        'America/Los_Angeles (UTC-08:00)',
                        'America/Denver (UTC-07:00)',
                        'America/Chicago (UTC-06:00)',
                        'America/New_York (UTC-05:00)',
                        'America/Halifax (UTC-04:00)',
                        'America/Argentina/Buenos_Aires (UTC-03:00)',
                        'Atlantic/South_Georgia (UTC-02:00)',
                        'Atlantic/Azores (UTC-01:00)',
                        'UTC (UTC+00:00)',
                        'Europe/London (UTC+00:00)',
                        'Europe/Berlin (UTC+01:00)',
                        'Europe/Athens (UTC+02:00)',
                        'Europe/Moscow (UTC+03:00)',
                        'Asia/Dubai (UTC+04:00)',
                        'Asia/Karachi (UTC+05:00)',
                        'Asia/Kolkata (UTC+05:30)',
                        'Asia/Dhaka (UTC+06:00)',
                        'Asia/Bangkok (UTC+07:00)',
                        'Asia/Singapore (UTC+08:00)',
                        'Asia/Tokyo (UTC+09:00)',
                        'Australia/Sydney (UTC+10:00)',
                        'Pacific/Noumea (UTC+11:00)',
                        'Pacific/Auckland (UTC+12:00)'
                      ]}
                      searchable={true}
                      className="w-full"
                    />
                  </div>

                  {/* Default Currency */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <DollarSign size={16} className="text-[var(--text-secondary)]" />
                      <label className="text-sm font-semibold text-[var(--text-primary)]">Default Currency</label>
                    </div>
                    <SearchableSelect
                      value={currency}
                      onChange={(val) => handleGlobalSettingChange('hrdesk_currency', val, setCurrency, 'Currency')}
                      options={[
                        { value: 'INR', label: 'INR (\u20B9) - Indian Rupee' },
                        { value: 'USD', label: 'USD ($) - US Dollar' },
                        { value: 'EUR', label: 'EUR (\u20AC) - Euro' },
                        { value: 'GBP', label: 'GBP (\u00A3) - British Pound' },
                        { value: 'AED', label: 'AED (\u062F.\u0625) - UAE Dirham' }
                      ]}
                      searchable={false}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ChangePasswordTab />
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Active Sessions & Devices</CardTitle>
                <CardDescription>Manage devices that are currently logged in to your account.</CardDescription>
              </CardHeader>
              <div className="flex justify-end px-6 pt-6 pb-2">
                <button 
                  onClick={handleRevokeAll}
                  className="text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-light)] px-4 py-2 rounded-md transition-colors cursor-pointer border border-[var(--danger-light)]"
                >
                  Log out of all other devices
                </button>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {loadingSessions ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">No active sessions found.</div>
                ) : (
                  sessions.map((session) => {
                    const colorClass = getDeviceColor(session.deviceName || session.deviceType || 'unknown');
                    return (
                      <div key={session.id} className="p-6 flex items-start gap-4 hover:bg-[var(--surface-hover)] transition-colors">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                          {session.deviceType.includes('Mobile') ? (
                            <Smartphone size={20} />
                          ) : (
                            <Laptop size={20} />
                          )}
                        </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{session.deviceName || session.deviceType}</h4>
                              {session.isCurrentSession && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Active Now
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mb-1">
                              IP: {session.ipAddress}
                              {session.location && session.location != 'Local Network' && ` • ${session.location}`}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">Last active: {new Date(session.lastActive).toLocaleString()}</p>
                          </div>
                          {!session.isCurrentSession ? (
                            <button 
                              onClick={() => handleRevokeSession(session.id)}
                              className="text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-light)] px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                            >
                              Log out
                            </button>
                          ) : (
                            <button 
                              onClick={() => logout()}
                              className="text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-light)] px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                            >
                              Log out
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
};
