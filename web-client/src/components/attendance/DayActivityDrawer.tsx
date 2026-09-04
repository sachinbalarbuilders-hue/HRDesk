import React, { useEffect, useState } from 'react';
import { SlidePanel } from '../ui/SlidePanel';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { AlertBanner } from '../ui/AlertBanner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EditAttendanceModal } from './EditAttendanceModal';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
  Building2,
  Camera,
  Timer,
  Trash2,
  Edit3,
  X,
  Plus
} from 'lucide-react';

interface DayActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  employeeId?: number;
  date?: string; // YYYY-MM-DD
  initialData?: any;
  onSuccess?: () => void;
}

export const DayActivityDrawer: React.FC<DayActivityDrawerProps> = ({
  open,
  onClose,
  employeeId,
  date,
  initialData,
  onSuccess
}) => {
  const { user, hasPermission } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Day Deletion state
  const [confirmDayDeleteOpen, setConfirmDayDeleteOpen] = useState(false);
  const [isDeletingDay, setIsDeletingDay] = useState(false);

  // Punch Pair Deletion state (delete any pair in case of 4+ punches)
  const [confirmPairDeleteOpen, setConfirmPairDeleteOpen] = useState(false);
  const [pairToDelete, setPairToDelete] = useState<{
    inPunch: any;
    outPunch?: any;
    pairNumber: number;
  } | null>(null);
  const [isDeletingPair, setIsDeletingPair] = useState(false);

  // Edit Attendance Modal state (Opened on odd punches)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalInTime, setEditModalInTime] = useState<string>('');
  const [editModalOutTime, setEditModalOutTime] = useState<string>('');
  const [editModalPunchId1, setEditModalPunchId1] = useState<number | undefined>(undefined);
  const [editModalPunchId2, setEditModalPunchId2] = useState<number | undefined>(undefined);

  // Permission checks
  const canEdit = Boolean(
    user?.isPlatformUser ||
    hasPermission('Attendance.Edit')
  );

  const canDelete = Boolean(
    user?.isPlatformUser ||
    hasPermission('Attendance.Delete')
  );

  const fetchDayDetails = async () => {
    if (!employeeId || !date) return;
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

  useEffect(() => {
    if (!open || !employeeId || !date) {
      setData(null);
      setError(null);
      setEditModalOpen(false);
      setConfirmPairDeleteOpen(false);
      setPairToDelete(null);
      return;
    }

    if (initialData) {
      setData((prev: any) => prev || initialData);
    }

    fetchDayDetails();
  }, [open, employeeId, date, initialData]);

  // Handle Delete Day Attendance (Entire record)
  const handleDeleteDay = async () => {
    if (!employeeId || !date) return;
    try {
      setIsDeletingDay(true);
      await apiClient.delete(`/attendance/day`, {
        params: { employeeId, date }
      });
      showSuccess(
        'Attendance Deleted',
        `Attendance for ${data?.employee?.name || 'employee'} on ${data?.formattedDate || date} has been deleted and recalculated.`
      );
      setConfirmDayDeleteOpen(false);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Could not delete attendance record.');
    } finally {
      setIsDeletingDay(false);
    }
  };

  // Open Edit Modal for a specific pair
  const handleOpenEditModal = (currentPunch?: any, nextOutPunch?: any) => {
    const rawIn = currentPunch?.time ? currentPunch.time.substring(0, 5) : (data?.inTime || '');
    const rawOut = nextOutPunch?.time ? nextOutPunch.time.substring(0, 5) : (data?.outTime || '');
    setEditModalInTime(rawIn);
    setEditModalOutTime(rawOut);
    setEditModalPunchId1(currentPunch?.id);
    setEditModalPunchId2(nextOutPunch?.id);
    setEditModalOpen(true);
  };

  // Open Delete Pair Modal
  const handleOpenDeletePairModal = (inPunch: any, outPunch?: any, pairNumber: number = 1) => {
    setPairToDelete({ inPunch, outPunch, pairNumber });
    setConfirmPairDeleteOpen(true);
  };

  // Handle Delete a Specific Punch Pair
  const handleDeletePair = async () => {
    if (!pairToDelete?.inPunch?.id) return;
    try {
      setIsDeletingPair(true);
      const p1 = pairToDelete.inPunch.id;
      const p2 = pairToDelete.outPunch?.id;
      await apiClient.delete(`/attendance/pair`, {
        params: {
          punchId1: p1,
          punchId2: p2 || undefined
        }
      });
      showSuccess(
        'Punch Pair Deleted',
        `Attendance session #${pairToDelete.pairNumber} has been deleted and daily attendance recalculated.`
      );
      setConfirmPairDeleteOpen(false);
      setPairToDelete(null);
      await fetchDayDetails();
      onSuccess?.();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Could not delete punch pair.');
    } finally {
      setIsDeletingPair(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Clocked In':
      case 'In Progress':
      case 'IP':
        return <Badge variant="info" dot>In Progress</Badge>;
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
        return <Badge variant="warning" dot>Single Punch</Badge>;
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

  const formatTime12h = (time24?: string) => {
    if (!time24) return null;
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes} ${ampm}`;
  };

  const getVerifyIcon = (verifyType: string) => {
    const v = (verifyType || '').toLowerCase();
    if (v.includes('face')) return <ScanFace size={13} className="text-purple-500 shrink-0" />;
    if (v.includes('web')) return <Globe size={13} className="text-blue-500 shrink-0" />;
    if (v.includes('mobile') || v.includes('gps')) return <MapPin size={13} className="text-amber-500 shrink-0" />;
    return <Fingerprint size={13} className="text-emerald-500 shrink-0" />;
  };

  const hasOnlySinglePunch = data?.totalPunches === 1 || (!data?.outTime && data?.inTime);
  const punchList: any[] = data?.punches || [];

  return (
    <>
      <SlidePanel
        open={open}
        onClose={onClose}
        title="Day Attendance Activity"
        subtitle={data?.formattedDate || date || 'Daily Punch Details'}
        width="wide"
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {punchList.length} swipe log{punchList.length === 1 ? '' : 's'}
            </span>

            <div className="flex items-center gap-2">
              {/* Delete Entire Day Attendance Button in Footer */}
              {canDelete && data?.totalPunches > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmDayDeleteOpen(true)}
                  disabled={isDeletingDay}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  <span>Delete Day Attendance</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {error ? (
          <div className="p-6">
            <AlertBanner
              type="error"
              title="Unable to load day details"
              message={error}
            />
          </div>
        ) : data ? (
          <div className="p-6 space-y-6">
            {/* 1. Employee Ledger Header */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={data.employee?.name || 'Employee'} size="lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-base font-bold text-[var(--text-primary)]">
                        {data.employee?.name}
                      </h3>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                        {data.employee?.code}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {data.employee?.department} • {data.employee?.designation}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {getStatusBadge(data.status)}
                </div>
              </div>

              {/* Ledger Metadata Rule */}
              <div className="pt-2.5 border-t border-[var(--border)]/70 flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[var(--text-muted)]">
                    <Building2 size={12} />
                    <span>{data.employee?.branch || 'Main Branch'}</span>
                  </span>
                  <span className="text-[var(--border)]">•</span>
                  <span className="flex items-center gap-1 text-[var(--text-muted)] font-mono text-[11px]">
                    <Calendar size={12} />
                    <span>{data.formattedDate || date}</span>
                  </span>
                </div>

                {data.shift?.name && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Shift:</span>
                    <span className="font-medium text-[var(--text-primary)] text-xs">
                      {data.shift.name} ({data.shift.start || '--'} - {data.shift.end || '--'})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Key Metrics Grid (4 ruled cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* FIRST IN */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <LogIn size={12} className="text-emerald-600 font-bold" /> First In
                </p>
                <p className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatTime12h(data.inTime) || '—'}
                </p>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {data.inTime ? `${data.inTime}` : 'No punch'}
                  </span>
                  {data.isLate && (
                    <span className="text-[10px] font-medium px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                      +{data.lateMinutes}m
                    </span>
                  )}
                </div>
              </div>

              {/* LAST OUT */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <LogOut size={12} className="text-rose-600 font-bold" /> Last Out
                </p>
                <p className={`text-base font-bold font-mono mt-1 ${data.outTime ? 'text-rose-700 dark:text-rose-400' : 'text-[var(--text-muted)] opacity-60'}`}>
                  {formatTime12h(data.outTime) || '—'}
                </p>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {data.outTime ? `${data.outTime}` : (data.inTime ? 'Open' : 'No punch')}
                  </span>
                  {data.isEarly && (
                    <span className="text-[10px] font-medium px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                      -{data.earlyMinutes}m
                    </span>
                  )}
                </div>
              </div>

              {/* WORK TIME */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Timer size={12} className="text-[var(--accent)]" /> Work Time
                </p>
                <p className="text-base font-bold font-mono text-[var(--text-primary)] mt-1">
                  {data.workMinutes > 0 ? data.workDurationFormatted : (data.inTime && !data.outTime ? 'In Progress' : '—')}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {data.workMinutes > 0 ? `${data.workMinutes} mins` : (data.inTime && !data.outTime ? 'Awaiting Out' : '0 mins')}
                </p>
              </div>

              {/* TOTAL SWIPES */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={12} className="text-indigo-500" /> Swipes
                </p>
                <p className="text-base font-bold font-mono text-[var(--text-primary)] mt-1">
                  {data.totalPunches} {data.totalPunches === 1 ? 'Punch' : 'Punches'}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {data.breakMinutes > 0 ? `${data.breakMinutes}m break` : '0m break'}
                </p>
              </div>
            </div>

            {/* Context Banners */}
            {hasOnlySinglePunch && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs">
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Single Punch Recorded</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Arrival recorded at {formatTime12h(data.inTime)}. The departure punch is missing.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalInTime(data.inTime || '');
                      setEditModalOutTime('');
                      setEditModalPunchId1(punchList[0]?.id);
                      setEditModalPunchId2(undefined);
                      setEditModalOpen(true);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
                  >
                    + Enter Out Time
                  </button>
                )}
              </div>
            )}

            {data.leave && (
              <AlertBanner
                type="warning"
                title={`Approved Leave: ${data.leave.type}`}
                message={data.leave.reason ? `Reason: "${data.leave.reason}"` : 'Approved leave application recorded for this date.'}
              />
            )}

            {data.holiday && (
              <AlertBanner
                type="success"
                title={`Public Holiday: ${data.holiday.name}`}
                message={data.holiday.description || 'Public holiday observed across the organization.'}
              />
            )}

            {/* 3. Punch Activity Feed */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={13} className="text-[var(--accent)]" />
                  <span>Punch Audit Trail ({data.totalPunches})</span>
                </h4>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">Chronological</span>
              </div>

              {loading && punchList.length === 0 ? (
                <div className="space-y-3 animate-pulse">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] h-20" />
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] h-20" />
                </div>
              ) : punchList.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/20">
                  <Clock size={28} className="mx-auto text-[var(--text-muted)] opacity-40 mb-2" />
                  <p className="text-xs font-semibold text-[var(--text-primary)]">No punch logs recorded</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    No biometric or web punches recorded for this day.
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditModalInTime('09:00');
                        setEditModalOutTime('18:00');
                        setEditModalPunchId1(undefined);
                        setEditModalPunchId2(undefined);
                        setEditModalOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold cursor-pointer hover:brightness-110 transition-all shadow-xs"
                    >
                      <Plus size={13} />
                      <span>Add Attendance</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {punchList.map((punch: any, idx: number) => {
                    const isIn = punch.punchType === 'In';
                    const punchNumber = idx + 1;
                    const isOdd = punchNumber % 2 !== 0;
                    const pairNumber = Math.floor(idx / 2) + 1;
                    const nextOutPunch = isOdd ? punchList[idx + 1] : undefined;

                    return (
                      <React.Fragment key={punch.id || idx}>
                        {/* Session / Pair Header for Odd Punches (Controls Entire Pair) */}
                        {isOdd && (
                          <div className="flex items-center justify-between pt-2 first:pt-0 pb-1.5 px-0.5 border-b border-[var(--border)]/70">
                            <div className="flex items-center gap-2">
                              <span className="font-serif text-xs font-bold text-[var(--text-primary)]">
                                Session #{pairNumber}
                              </span>
                              <span className="font-mono text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded border border-[var(--border)]">
                                {nextOutPunch ? `Punches #${punchNumber} & #${punchNumber + 1}` : `Punch #${punchNumber} (Open)`}
                              </span>
                            </div>

                            {/* Entire Pair Actions: Edit and Delete Any Pair */}
                            <div className="flex items-center gap-1.5">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(punch, nextOutPunch)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-bold text-[var(--accent)] cursor-pointer transition-colors shadow-2xs"
                                  title={`Edit Session #${pairNumber}`}
                                >
                                  <Edit3 size={11} />
                                  <span>Edit</span>
                                </button>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeletePairModal(punch, nextOutPunch, pairNumber)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer transition-colors shadow-2xs"
                                  title={`Delete entire Pair #${pairNumber}`}
                                >
                                  <Trash2 size={11} />
                                  <span>{nextOutPunch ? `Delete Pair #${pairNumber}` : 'Delete Punch'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Individual Punch Timeline Step */}
                        <div className="relative pl-6 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-[var(--border)] group">
                          {/* Timeline Step Dot */}
                          <div
                            className={`absolute left-[3px] top-3.5 w-4 h-4 rounded-full border-2 border-[var(--surface)] flex items-center justify-center shadow-2xs ${
                              isIn
                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-100 dark:ring-emerald-950/60'
                                : 'bg-rose-600 text-white ring-2 ring-rose-100 dark:ring-rose-950/60'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          {/* Punch Ledger Card */}
                          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border)]/80 hover:shadow-2xs transition-all">
                            <div className="flex items-center justify-between gap-3">
                              {/* Left: Type tag, time */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {isIn ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 tracking-wider">
                                    <LogIn size={11} strokeWidth={2.5} />
                                    IN
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 tracking-wider">
                                    <LogOut size={11} strokeWidth={2.5} />
                                    OUT
                                  </span>
                                )}

                                <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                                  {punch.timeShort}
                                </span>
                                <span className="text-xs font-mono text-[var(--text-muted)]">
                                  ({punch.time})
                                </span>
                              </div>

                              {/* Right: Punch number tag */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-medium bg-[var(--surface-secondary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                                  #{punchNumber}
                                </span>
                              </div>
                            </div>

                            {/* Metadata row: Device, Mode, Location, IP, Photo */}
                            <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                              <div className="flex items-center gap-1.5">
                                {getVerifyIcon(punch.verifyType)}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {punch.verifyType || 'Biometric'}
                                </span>
                                <span className="text-[var(--text-muted)] text-[11px]">• {punch.machineNumber}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {punch.ipAddress && (
                                <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                                  <span className="font-mono text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]/70">
                                    {punch.ipAddress}
                                  </span>
                                  {punch.isIpValid !== null && (
                                    <span className={`px-1 py-0.2 rounded text-[10px] font-medium ${
                                      punch.isIpValid 
                                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' 
                                        : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                                    }`}>
                                      {punch.isIpValid ? 'Office' : 'Remote'}
                                    </span>
                                  )}
                                </div>
                              )}

                              {punch.latitude && punch.longitude && (
                                <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                                  <MapPin size={11} className="text-rose-500 shrink-0" />
                                  <span className="font-mono text-[10px]">{punch.latitude.toFixed(3)}, {punch.longitude.toFixed(3)}</span>
                                  {punch.isGeofenceValid !== null && (
                                    <span className={`px-1 py-0.2 rounded text-[10px] font-medium ${
                                      punch.isGeofenceValid 
                                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' 
                                        : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                                    }`}>
                                      {punch.isGeofenceValid ? 'Geofenced' : 'Outside'}
                                    </span>
                                  )}
                                </div>
                              )}

                              {punch.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhoto(punch.photoUrl)}
                                  className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline font-medium cursor-pointer ml-1"
                                >
                                  <Camera size={12} />
                                  <span>Photo</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                  );
                })}
                </div>
              )}
            </div>

            {/* Photo Modal */}
            {selectedPhoto && (
              <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                onClick={() => setSelectedPhoto(null)}
              >
                <div
                  className="bg-[var(--surface)] p-4 rounded-xl max-w-sm w-full space-y-3 shadow-xl border border-[var(--border)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Punch Verification Photo</h4>
                    <button
                      onClick={() => setSelectedPhoto(null)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <img
                    src={selectedPhoto}
                    alt="Punch verification"
                    className="w-full h-auto rounded-lg object-cover border border-[var(--border)]"
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SlidePanel>

      {/* Edit Attendance Modal (Detailed form like Add Attendance, prefilled for editing) */}
      <EditAttendanceModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          fetchDayDetails();
          onSuccess?.();
        }}
        employeeId={employeeId}
        employeeName={data?.employee?.name}
        employeeCode={data?.employee?.code}
        departmentName={data?.employee?.department}
        date={data?.formattedDate ? date : date}
        initialInTime={editModalInTime}
        initialOutTime={editModalOutTime}
        punchId1={editModalPunchId1}
        punchId2={editModalPunchId2}
      />

      {/* Confirmation Dialog: Delete Specific Punch Pair */}
      <ConfirmDialog
        open={confirmPairDeleteOpen}
        onClose={() => {
          setConfirmPairDeleteOpen(false);
          setPairToDelete(null);
        }}
        onConfirm={handleDeletePair}
        busy={isDeletingPair}
        tone="danger"
        title={`Delete Punch Pair #${pairToDelete?.pairNumber || ''}`}
        confirmLabel="Delete Pair"
        message={
          <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
            <p>
              Are you sure you want to delete this punch pair for{' '}
              <strong className="text-[var(--text-primary)]">{data?.employee?.name}</strong> on{' '}
              <strong className="text-[var(--text-primary)]">{data?.formattedDate || date}</strong>?
            </p>
            <div className="p-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] font-mono text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">In Punch:</span>
                <span className="font-bold text-[var(--text-primary)]">{pairToDelete?.inPunch?.timeShort || '—'}</span>
              </div>
              {pairToDelete?.outPunch && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Out Punch:</span>
                  <span className="font-bold text-[var(--text-primary)]">{pairToDelete?.outPunch?.timeShort || '—'}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              This pair will be removed, and daily attendance will be recalculated with any remaining punches.
            </p>
          </div>
        }
      />

      {/* Confirmation Dialog: Delete Entire Day Attendance */}
      <ConfirmDialog
        open={confirmDayDeleteOpen}
        onClose={() => setConfirmDayDeleteOpen(false)}
        onConfirm={handleDeleteDay}
        busy={isDeletingDay}
        tone="danger"
        title="Delete Day Attendance"
        confirmLabel="Delete Attendance"
        message={
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            <p>
              Are you sure you want to delete the complete attendance record for{' '}
              <strong className="text-[var(--text-primary)]">{data?.employee?.name}</strong> on{' '}
              <strong className="text-[var(--text-primary)]">{data?.formattedDate || date}</strong>?
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              This will permanently remove all punches for this day. The daily attendance status will be recalculated based on their shift roster.
            </p>
          </div>
        }
      />
    </>
  );
};
