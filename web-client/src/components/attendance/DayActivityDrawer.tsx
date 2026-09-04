import React, { useEffect, useState } from 'react';
import { SlidePanel } from '../ui/SlidePanel';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { AlertBanner } from '../ui/AlertBanner';
import { apiClient } from '../../api/client';
import {
  Clock,
  Activity,
  LogIn,
  LogOut,
  MapPin,
  Globe,
  Fingerprint,
  ScanFace,
  Calendar,
  AlertCircle,
  Coffee,
  Building2,
  FileText,
  Camera,
  Info,
  Timer
} from 'lucide-react';

interface DayActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  employeeId?: number;
  date?: string; // YYYY-MM-DD
  initialData?: any;
}

export const DayActivityDrawer: React.FC<DayActivityDrawerProps> = ({
  open,
  onClose,
  employeeId,
  date,
  initialData
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !employeeId || !date) {
      setData(null);
      setError(null);
      return;
    }

    // Set instant initial data if provided
    if (initialData) {
      setData((prev: any) => prev || initialData);
    }

    const fetchDayDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<any>(`/attendance/day-details?employeeId=${employeeId}&date=${date}`);
        setData(res.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load day activity logs');
      } finally {
        setLoading(false);
      }
    };

    fetchDayDetails();
  }, [open, employeeId, date, initialData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Clocked In':
      case 'In Progress':
      case 'IP':
        return <Badge variant="info" dot>Clocked In (In Progress)</Badge>;
      case 'Present':
        return <Badge variant="success" dot>Present</Badge>;
      case 'Absent':
        return <Badge variant="danger" dot>Absent</Badge>;
      case 'Single Punch':
      case 'SP':
      case 'Missing Out':
      case 'Missing In':
      case 'MO':
      case 'MI':
        return <Badge variant="warning" dot>Single Punch (Regularization Required)</Badge>;
      case 'Half Day':
      case 'HF':
        return <Badge variant="warning" dot>Half Day</Badge>;
      case 'CO':
      case 'COHF':
        return <Badge variant="warning" dot>Comp Off</Badge>;
      case 'Weekoff':
      case 'W/O':
      case 'WO':
        return <Badge variant="neutral">Week Off</Badge>;
      case 'Holiday':
        return <Badge variant="info">Holiday</Badge>;
      default:
        return <Badge variant="default">{status || 'Unknown'}</Badge>;
    }
  };

  const getVerifyIcon = (verifyType: string) => {
    const v = (verifyType || '').toLowerCase();
    if (v.includes('face')) return <ScanFace size={14} className="text-purple-500 shrink-0" />;
    if (v.includes('web')) return <Globe size={14} className="text-blue-500 shrink-0" />;
    if (v.includes('mobile') || v.includes('gps')) return <MapPin size={14} className="text-amber-500 shrink-0" />;
    return <Fingerprint size={14} className="text-emerald-500 shrink-0" />;
  };

  // Format 24h time to 12h AM/PM
  const formatTime12h = (time24?: string) => {
    if (!time24) return null;
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  const hasOnlySinglePunch = data?.punches?.length === 1 && data?.inTime && !data?.outTime;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      size="2xl"
      title="Attendance Activity Details"
      description="Daily punch logs and work activity timeline"
    >
      {error && !data ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : !data && loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading punch history...</p>
        </div>
      ) : data ? (
        <div className="space-y-5 pb-6">
          {/* 1. Employee & Day Header Card */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 shadow-xs space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="ring-2 ring-[var(--border)] rounded-full p-0.5 bg-[var(--surface)]">
                  <Avatar name={data.employee?.name || 'Employee'} size="lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {data.employee?.name}
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-[var(--accent)] bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border)] shadow-2xs">
                      {data.employee?.code}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {data.employee?.designation} • {data.employee?.department}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                    <Building2 size={12} className="text-[var(--text-muted)]" />
                    <span>{data.employee?.branch}</span>
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {getStatusBadge(data.status)}
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border)]/70 flex items-center justify-between gap-2 flex-wrap text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <Calendar size={14} className="text-[var(--accent)]" />
                {data.formattedDate}
              </span>
              {data.shift && (
                <span className="text-[11px] font-medium bg-[var(--surface)] text-[var(--text-secondary)] px-2.5 py-1 rounded-md border border-[var(--border)] shadow-2xs">
                  Shift: <strong className="text-[var(--text-primary)]">{data.shift.name}</strong> ({data.shift.startTime} - {data.shift.endTime})
                </span>
              )}
            </div>
          </div>

          {/* 2. Key Metrics Summary Grid (4 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* FIRST IN */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <LogIn size={13} className="text-emerald-600 font-bold" /> First In
              </p>
              <p className="text-base font-bold font-data text-emerald-700 dark:text-emerald-400 mt-1.5">
                {formatTime12h(data.inTime) || '—'}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {data.inTime ? `${data.inTime} (24h)` : 'No punch recorded'}
              </p>
              {data.isLate && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                  Late by {data.lateMinutes}m
                </p>
              )}
            </div>

            {/* LAST OUT */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <LogOut size={13} className="text-rose-600 font-bold" /> Last Out
              </p>
              <p className={`text-base font-bold font-data mt-1.5 ${data.outTime ? 'text-rose-700 dark:text-rose-400' : 'text-[var(--text-muted)] opacity-60'}`}>
                {formatTime12h(data.outTime) || '—'}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {data.outTime ? `${data.outTime} (24h)` : (data.inTime ? 'Open / In progress' : 'No punch recorded')}
              </p>
              {data.isEarly && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                  Early by {data.earlyMinutes}m
                </p>
              )}
            </div>

            {/* WORK TIME */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Timer size={13} className="text-[var(--accent)]" /> Work Time
              </p>
              <p className="text-base font-bold font-data text-[var(--accent)] mt-1.5">
                {data.workMinutes > 0 ? data.workDurationFormatted : (data.inTime && !data.outTime ? 'In Progress' : '—')}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {data.workMinutes > 0 ? `${data.workMinutes} total mins` : (data.inTime && !data.outTime ? 'Awaiting Out-punch' : '0 mins')}
              </p>
            </div>

            {/* BREAKS / PUNCHES */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Coffee size={13} className="text-indigo-500" /> Swipes
              </p>
              <p className="text-base font-bold font-data text-[var(--text-primary)] mt-1.5">
                {data.totalPunches} {data.totalPunches === 1 ? 'Punch' : 'Punches'}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {data.breakMinutes > 0 ? `${data.breakMinutes}m break recorded` : 'No break duration'}
              </p>
            </div>
          </div>

          {/* Single Punch Informative Banner */}
          {hasOnlySinglePunch && (
            <AlertBanner
              type="info"
              title="Single Punch Recorded"
              message={`Only the arrival punch was recorded at ${formatTime12h(data.inTime)}. The departure punch has not been captured yet or was missed.`}
            />
          )}

          {/* Leave Banner */}
          {data.leave && (
            <AlertBanner
              type="warning"
              title={`Approved Leave: ${data.leave.type}`}
              message={data.leave.reason ? `Reason: "${data.leave.reason}"` : 'Approved leave request recorded for this date.'}
            />
          )}

          {/* Holiday Banner */}
          {data.holiday && (
            <AlertBanner
              type="success"
              title={`Public Holiday: ${data.holiday.name}`}
              message={data.holiday.description || 'Public holiday observed across the organization.'}
            />
          )}

          {/* 3. Punch Activity Timeline Feed */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={14} className="text-[var(--accent)]" />
                Punch Activity Timeline ({data.totalPunches})
              </h4>
              <span className="text-[11px] text-[var(--text-muted)]">Chronological order</span>
            </div>

            {loading && (!data.punches || data.punches.length === 0) ? (
              <div className="space-y-3 pt-1 animate-pulse">
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-28 bg-[var(--surface-secondary)] rounded-md" />
                    <div className="h-5 w-8 bg-[var(--surface-secondary)] rounded" />
                  </div>
                  <div className="h-4 w-48 bg-[var(--surface-secondary)] rounded" />
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-28 bg-[var(--surface-secondary)] rounded-md" />
                    <div className="h-5 w-8 bg-[var(--surface-secondary)] rounded" />
                  </div>
                  <div className="h-4 w-48 bg-[var(--surface-secondary)] rounded" />
                </div>
              </div>
            ) : (!data.punches || data.punches.length === 0) ? (
              <div className="p-10 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/20">
                <Clock size={32} className="mx-auto text-[var(--text-muted)] opacity-40 mb-2" />
                <p className="text-xs font-semibold text-[var(--text-primary)]">No punch logs recorded</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  No web, mobile, face scan, or biometric punch was recorded for this day.
                </p>
              </div>
            ) : (
              <div className="relative pl-7 space-y-3.5 before:absolute before:left-[13px] before:top-3 before:bottom-3 before:w-[2px] before:bg-[var(--border)]">
                {data.punches.map((punch: any, idx: number) => {
                  const isIn = punch.punchType === 'In';
                  return (
                    <div key={punch.id || idx} className="relative group">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute -left-[27px] top-3.5 w-5 h-5 rounded-full border-2 border-[var(--surface)] flex items-center justify-center shadow-xs ${
                          isIn
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950/60'
                            : 'bg-rose-600 text-white ring-4 ring-rose-100 dark:ring-rose-950/60'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>

                      {/* Punch Card */}
                      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:shadow-xs transition-all">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {isIn ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 text-white shadow-xs tracking-wide">
                                <LogIn size={13} strokeWidth={2.5} />
                                PUNCH IN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 text-white shadow-xs tracking-wide">
                                <LogOut size={13} strokeWidth={2.5} />
                                PUNCH OUT
                              </span>
                            )}

                            <span className="text-sm font-extrabold font-data text-[var(--text-primary)]">
                              {punch.timeShort}
                            </span>
                            <span className="text-xs font-mono font-medium text-[var(--text-muted)]">
                              ({punch.time})
                            </span>
                          </div>

                          <span className="text-[11px] font-mono font-bold bg-[var(--surface-secondary)] text-[var(--text-primary)] px-2 py-0.5 rounded border border-[var(--border)]">
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Punch Metadata: Device, Verification Mode, Location, IP, Photo */}
                        <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                          <div className="flex items-center gap-2 truncate">
                            {getVerifyIcon(punch.verifyType)}
                            <span className="font-bold text-[var(--text-primary)]">
                              {punch.verifyType || 'Biometric'}
                            </span>
                            <span className="text-[var(--text-muted)] truncate font-medium">• {punch.machineNumber}</span>
                          </div>

                          {punch.ipAddress && (
                            <div className="flex items-center gap-1.5 truncate text-[var(--text-muted)] text-[11px]">
                              <span className="font-medium text-[var(--text-secondary)]">IP:</span>
                              <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]/70">
                                {punch.ipAddress}
                              </span>
                              {punch.isIpValid !== null && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  punch.isIpValid 
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                }`}>
                                  {punch.isIpValid ? '✓ Office IP' : '⚠ Remote'}
                                </span>
                              )}
                            </div>
                          )}

                          {punch.latitude && punch.longitude && (
                            <div className="flex items-center gap-1.5 col-span-full text-[11px] text-[var(--text-muted)]">
                              <MapPin size={13} className="text-rose-500 shrink-0" />
                              <span className="font-medium text-[var(--text-primary)]">GPS: {punch.latitude.toFixed(4)}, {punch.longitude.toFixed(4)}</span>
                              {punch.isGeofenceValid !== null && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  punch.isGeofenceValid 
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                }`}>
                                  {punch.isGeofenceValid ? '✓ Inside Geofence' : '⚠ Outside Radius'}
                                </span>
                              )}
                            </div>
                          )}

                          {punch.photoUrl && (
                            <div className="col-span-full mt-1">
                              <button
                                onClick={() => setSelectedPhoto(punch.photoUrl)}
                                className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline font-bold cursor-pointer"
                              >
                                <Camera size={13} />
                                <span>View punch verification photo</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Photo Modal */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedPhoto(null)}
            >
              <div
                className="bg-[var(--surface)] p-4 rounded-2xl max-w-sm w-full space-y-3 shadow-2xl border border-[var(--border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Punch Verification Photo</h4>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>
                <img
                  src={selectedPhoto}
                  alt="Punch verification"
                  className="w-full h-auto rounded-xl object-cover border border-[var(--border)]"
                />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </SlidePanel>
  );
};
