import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

  // Animated ring state for opening sweep effect
  const [ringAnimated, setRingAnimated] = useState(false);

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
      setRingAnimated(false);
      return;
    }

    setRingAnimated(false);
    const animTimer = setTimeout(() => {
      setRingAnimated(true);
    }, 120);

    if (initialData) {
      setData((prev: any) => prev || initialData);
    }

    fetchDayDetails();

    return () => clearTimeout(animTimer);
  }, [open, employeeId, date, initialData]);

  // Dedicated fill animation trigger: sweeps the circle from 0 to target as soon as attendance data is ready
  useEffect(() => {
    if (!open || !data) return;
    setRingAnimated(false);
    const timer = setTimeout(() => {
      setRingAnimated(true);
    }, 60);
    return () => clearTimeout(timer);
  }, [open, data?.workMinutes, data?.totalPunches, data?.inTime, data?.outTime]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editModalOpen && !confirmPairDeleteOpen && !confirmDayDeleteOpen && !selectedPhoto) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose, editModalOpen, confirmPairDeleteOpen, confirmDayDeleteOpen, selectedPhoto]);

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

  const punchList: any[] = data?.punches || [];

  // ── Dial Presentation (Pure presentation driven by backend API dial payload) ──
  const dial = data?.dial;
  const regularWorkM = dial?.regularWorkMinutes ?? 0;
  const otM = dial?.overtimeMinutes ?? 0;
  const hasOvertime = dial?.isOvertime ?? false;
  const breakM = dial?.breakMinutes ?? data?.breakMinutes ?? 0;
  const remainingM = dial?.remainingMinutes ?? 0;
  const shiftM = dial?.shiftTotalMinutes ?? 540;
  const isInProgress = dial?.isShiftInProgress ?? false;
  const workedM = dial?.effectiveWorkMinutes ?? (data?.workMinutes || 0);
  const displayHoursMinutes = dial?.totalWorkFormatted || data?.workDurationFormatted || '00hr 00min';

  // SVG Geometry: converts backend segments into visual arc lengths (seamless continuous ring)
  const radius = 80;
  const circumference = 2 * Math.PI * radius; // ~502.655
  const rawSegments: { id: string; label: string; minutes: number; color: string }[] = dial?.segments || [];

  const totalSegmentsMinutes = rawSegments.reduce((acc, s) => acc + s.minutes, 0);
  const totalMinutesForCircle = Math.max(shiftM, totalSegmentsMinutes);

  let currentAngle = 0;

  const activeSegments = rawSegments.map((seg) => {
    const fraction = totalMinutesForCircle > 0 ? seg.minutes / totalMinutesForCircle : 0;
    const arcLen = fraction * circumference;

    const segRotate = currentAngle;
    const segDegrees = (arcLen / circumference) * 360;
    currentAngle += segDegrees;

    const dashoffset = ringAnimated ? circumference - arcLen : circumference;

    return {
      ...seg,
      arcLength: arcLen,
      rotate: segRotate,
      dashoffset
    };
  });

  if (!open) return null;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-activity-title"
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[var(--surface)] rounded-xl border border-[var(--rule)] shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--rule)] bg-[var(--paper)]/60 flex items-center justify-between shrink-0">
              <div>
                <h2 id="day-activity-title" className="font-serif text-lg font-bold text-[var(--ink)] tracking-tight text-balance">
                  Day Attendance Activity
                </h2>
                <p className="text-xs font-mono text-[var(--ink-muted)] mt-0.5 tabular-nums">
                  {data?.formattedDate || date || 'Daily Punch Details'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1.5 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                title="Close (Esc)"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            {error ? (
              <div className="p-6">
                <AlertBanner
                  type="error"
                  title="Unable to load day details"
                  message={error}
                />
              </div>
            ) : data ? (
              <div className="overflow-y-auto p-6 space-y-5 flex-1 custom-scrollbar">
                {/* 1. Employee Ledger Header */}
                <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={data.employee?.name || 'Employee'} size="lg" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-base font-bold text-[var(--ink)]">
                            {data.employee?.name}
                          </h3>
                          <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--rule)]">
                            {data.employee?.code}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                          {data.employee?.department} • {data.employee?.designation}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {getStatusBadge(data.status)}
                    </div>
                  </div>

                  {/* Ledger Metadata Rule */}
                  <div className="pt-2.5 border-t border-[var(--rule)] flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Building2 size={12} />
                        <span>{data.employee?.branch || 'Main Branch'}</span>
                      </span>
                      <span className="text-[var(--rule)]">•</span>
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Calendar size={12} />
                        <span>{data.formattedDate || date}</span>
                      </span>
                    </div>

                    {data.shift?.name && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-mono font-bold text-[var(--ink-muted)] tracking-wider">Shift:</span>
                        <span className="font-mono font-medium text-[var(--ink)] text-xs">
                          {data.shift.name} ({data.shift.start || '--'} - {data.shift.end || '--'})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Hero Total Work Circular Gauge & Key Metrics */}
                <div className="p-4 sm:p-5 rounded-xl border border-[var(--rule)] bg-[var(--surface)] shadow-2xs flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                  {/* Left: Reference Circular Donut Dial with opening animation */}
                  <div className="flex flex-col items-center shrink-0">
                    {/* Donut Ring + Absolutely Centered Text (Strictly bounded to 208x208) */}
                    <div className="relative w-52 h-52 flex items-center justify-center">
                      <svg className="w-52 h-52 -rotate-90" viewBox="0 0 200 200">
                        {/* Background Track */}
                        <circle
                          cx="100"
                          cy="100"
                          r="80"
                          className="stroke-[var(--rule)] opacity-35 dark:opacity-20"
                          strokeWidth="10"
                          fill="transparent"
                        />

                        {/* Dynamic Color Split Segments */}
                        {activeSegments.map((seg) => (
                          <circle
                            key={seg.id}
                            cx="100"
                            cy="100"
                            r="80"
                            stroke={seg.color}
                            strokeWidth="10"
                            strokeDasharray={`${circumference} ${circumference}`}
                            strokeDashoffset={seg.dashoffset}
                            strokeLinecap={activeSegments.length > 1 ? "butt" : "round"}
                            transform={seg.rotate !== 0 ? `rotate(${seg.rotate} 100 100)` : undefined}
                            fill="transparent"
                            style={{
                              transition: 'stroke-dashoffset 1200ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                            }}
                          />
                        ))}
                      </svg>

                      {/* Center Text (Total Work / 09hr 47min) strictly bounded inside the 208x208 circle */}
                      <div
                        className={`absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none select-none transition-all duration-700 delay-150 transform ${
                          ringAnimated ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                      >
                        <span className="text-xs font-sans font-medium text-slate-500 dark:text-neutral-400 tracking-wide">
                          Total Work
                        </span>
                        <span className="font-sans font-bold text-xl sm:text-2xl text-teal-600 dark:text-teal-400 tracking-tight tabular-nums mt-0.5 whitespace-nowrap max-w-[136px] truncate">
                          {displayHoursMinutes}
                        </span>
                        <span className="text-[11px] font-sans font-medium mt-1 whitespace-nowrap max-w-[136px] truncate">
                          {dial?.subtitle ? (
                            <span className={dial.isAfterHours ? "text-amber-600 dark:text-amber-400" : dial.lateArrivalMinutes > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : isInProgress ? "text-blue-600 dark:text-blue-400" : "text-[var(--ink-muted)]"}>
                              {isInProgress && !dial.isAfterHours && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1 align-middle" />}
                              {dial.subtitle}
                            </span>
                          ) : isInProgress ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> In Progress
                            </span>
                          ) : workedM > 0 ? (
                            <span className="text-[var(--ink-muted)] tabular-nums">
                              {Math.round((workedM / shiftM) * 100)}% of {Math.round(shiftM / 60)}h shift
                            </span>
                          ) : (
                            <span className="text-[var(--ink-muted)]">0 mins</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Color Splits Legend - dynamically driven by backend dial segments */}
                    <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] font-sans max-w-[260px]">
                      {rawSegments.map((seg) => (
                        <span key={seg.id} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className="text-[var(--ink)] font-medium tabular-nums">
                            {seg.label}: {Math.floor(seg.minutes / 60)}h {seg.minutes % 60}m
                          </span>
                        </span>
                      ))}
                      {!dial?.isAfterHours && remainingM > 0 && (
                        <span className="flex items-center gap-1 text-[var(--ink-muted)] tabular-nums">
                          <span className="w-2 h-2 rounded-full bg-[var(--rule)] shrink-0" />
                          <span>Rem: {Math.floor(remainingM / 60)}h {remainingM % 60}m</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Key Metrics (2x2 Grid) */}
                  <div className="grid grid-cols-2 gap-2.5 flex-1 w-full">
                    {/* FIRST IN */}
                    <div className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-mono font-semibold text-[var(--ink-muted)] uppercase tracking-wider flex items-center gap-1.5">
                          <LogIn size={12} className={data.isLate ? 'text-amber-600' : 'text-emerald-700'} /> First In
                        </p>
                        <p className={`text-base font-bold font-mono tabular-nums mt-1 ${data.isLate ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
                          {formatTime12h(data.inTime) || '—'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-[var(--rule)]/50">
                        <span className="text-[10px] font-mono tabular-nums text-[var(--ink-muted)]">
                          {data.inTime ? `${data.inTime}` : 'No punch'}
                        </span>
                        {data.isLate && (
                          <span className="text-[10px] font-mono tabular-nums font-medium px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            +{data.lateMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LAST OUT */}
                    <div className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-mono font-semibold text-[var(--ink-muted)] uppercase tracking-wider flex items-center gap-1.5">
                          <LogOut size={12} className="text-neutral-600" /> Last Out
                        </p>
                        <p className={`text-base font-bold font-mono tabular-nums mt-1 ${data.outTime ? 'text-indigo-700 dark:text-indigo-400' : 'text-[var(--ink-muted)] opacity-60'}`}>
                          {formatTime12h(data.outTime) || (data.inTime ? 'Open' : '—')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-[var(--rule)]/50">
                        <span className="text-[10px] font-mono tabular-nums text-[var(--ink-muted)]">
                          {data.outTime ? `${data.outTime}` : (data.inTime ? 'Awaiting Out' : 'No punch')}
                        </span>
                        {data.isEarly && (
                          <span className="text-[10px] font-mono tabular-nums font-medium px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            -{data.earlyMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* BREAK TIME */}
                    <div className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-mono font-semibold text-[var(--ink-muted)] uppercase tracking-wider flex items-center gap-1.5">
                          <Timer size={12} className="text-amber-600" /> Break Time
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-[var(--ink)] mt-1">
                          {data.breakMinutes > 0 ? `${data.breakMinutes} mins` : '0 mins'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-[var(--rule)]/50">
                        <span className="text-[10px] font-mono tabular-nums text-[var(--ink-muted)]">
                          {data.breakMinutes > 0 ? `${data.breakMinutes}m logged` : 'No break logged'}
                        </span>
                      </div>
                    </div>

                    {/* TOTAL SWIPES */}
                    <div className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-mono font-semibold text-[var(--ink-muted)] uppercase tracking-wider flex items-center gap-1.5">
                          <Activity size={12} className="text-[var(--ink-muted)]" /> Swipes
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-[var(--ink)] mt-1">
                          {data.totalPunches} {data.totalPunches === 1 ? 'Punch' : 'Punches'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-[var(--rule)]/50">
                        <span className="text-[10px] font-mono tabular-nums text-[var(--ink-muted)]">
                          {punchList.length} punch log{punchList.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Context Banners */}
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
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                    <h4 className="text-xs font-mono font-bold text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={13} className="text-[var(--ink-muted)]" />
                      <span>Punch Audit Trail ({data.totalPunches})</span>
                    </h4>
                    <span className="text-[11px] font-mono text-[var(--ink-muted)]">Chronological</span>
                  </div>

                  {loading && punchList.length === 0 ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)] h-20" />
                      <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)] h-20" />
                    </div>
                  ) : punchList.length === 0 ? (
                    <div className="p-8 text-center rounded-lg border border-dashed border-[var(--rule)] bg-[var(--paper)]/30">
                      <Clock size={28} className="mx-auto text-[var(--ink-muted)] opacity-40 mb-2" />
                      <p className="text-xs font-semibold text-[var(--ink)]">No punch logs recorded</p>
                      <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
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
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--paper)] text-xs font-mono font-medium text-[var(--ink)] cursor-pointer transition-colors shadow-2xs"
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
                              <div className="flex items-center justify-between pt-2 first:pt-0 pb-1.5 px-0.5 border-b border-[var(--rule)]">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                                    Session #{pairNumber}
                                  </span>
                                  <span className="font-mono text-[10px] font-medium text-[var(--ink-muted)] bg-[var(--paper)] px-2 py-0.5 rounded border border-[var(--rule)]">
                                    {nextOutPunch ? `Punches #${punchNumber} & #${punchNumber + 1}` : `Punch #${punchNumber} (Open)`}
                                  </span>
                                </div>

                                {/* Entire Pair Actions: Edit and Delete Any Pair */}
                                <div className="flex items-center gap-2">
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(punch, nextOutPunch)}
                                      aria-label={`Edit Session #${pairNumber}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--paper)] text-xs font-mono font-medium text-[var(--ink)] cursor-pointer transition-colors shadow-2xs"
                                      title={`Edit Session #${pairNumber}`}
                                    >
                                      <Edit3 size={11} className="text-[var(--ink-muted)]" aria-hidden="true" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDeletePairModal(punch, nextOutPunch, pairNumber)}
                                      aria-label={nextOutPunch ? `Delete Pair #${pairNumber}` : 'Delete Punch'}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-transparent hover:border-red-200 hover:bg-red-50/70 text-xs font-mono text-[var(--ink-muted)] hover:text-red-700 cursor-pointer transition-colors"
                                      title={`Delete entire Pair #${pairNumber}`}
                                    >
                                      <Trash2 size={11} aria-hidden="true" />
                                      <span>{nextOutPunch ? `Delete Pair #${pairNumber}` : 'Delete Punch'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Individual Punch Timeline Step */}
                            <div className="relative pl-6 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-[var(--rule)] group">
                              {/* Timeline Step Dot */}
                              <div
                                className={`absolute left-[5px] top-4 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface)] flex items-center justify-center shadow-2xs ${
                                  isIn
                                    ? 'bg-emerald-700 ring-1 ring-emerald-300'
                                    : 'bg-neutral-600 ring-1 ring-neutral-300'
                                }`}
                              >
                                <div className="w-1 h-1 rounded-full bg-white" />
                              </div>

                              {/* Punch Ledger Card */}
                              <div className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--surface)] hover:border-[var(--ink-muted)]/50 transition-colors">
                                <div className="flex items-center justify-between gap-3">
                                  {/* Left: Type tag, time */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isIn ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider">
                                        <LogIn size={10} strokeWidth={2.5} aria-hidden="true" />
                                        IN
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-300 tracking-wider">
                                        <LogOut size={10} strokeWidth={2.5} aria-hidden="true" />
                                        OUT
                                      </span>
                                    )}

                                    <span className="text-sm font-bold font-mono tabular-nums text-[var(--ink)]">
                                      {punch.timeShort}
                                    </span>
                                    <span className="text-xs font-mono tabular-nums text-[var(--ink-muted)]">
                                      ({punch.time})
                                    </span>
                                  </div>

                                  {/* Right: Punch number tag */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono tabular-nums font-medium bg-[var(--paper)] text-[var(--ink-muted)] px-1.5 py-0.5 rounded border border-[var(--rule)]">
                                      #{punchNumber}
                                    </span>
                                  </div>
                                </div>

                                {/* Metadata row: Device, Mode, Location, IP, Photo */}
                                <div className="mt-2 pt-2 border-t border-[var(--rule)]/60 flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
                                  <div className="flex items-center gap-1.5">
                                    {getVerifyIcon(punch.verifyType)}
                                    <span className="font-mono font-medium text-[var(--ink)]">
                                      {punch.verifyType || 'Biometric'}
                                    </span>
                                    <span className="text-[var(--ink-muted)] text-[11px] font-mono tabular-nums">• {punch.machineNumber}</span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    {punch.ipAddress && (
                                      <div className="flex items-center gap-1 text-[11px]">
                                        <span className="font-mono tabular-nums text-[10px] font-medium text-[var(--ink)] bg-[var(--paper)] px-1.5 py-0.5 rounded border border-[var(--rule)]">
                                          {punch.ipAddress}
                                        </span>
                                        {punch.isIpValid !== null && (
                                          <span className="px-1 py-0.2 rounded font-mono text-[10px] font-medium text-[var(--ink-muted)] border border-[var(--rule)] bg-[var(--paper)]">
                                            {punch.isIpValid ? 'Office' : 'Remote'}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {punch.latitude && punch.longitude && (
                                      <div className="flex items-center gap-1 text-[11px]">
                                        <MapPin size={11} className="text-neutral-500 shrink-0" aria-hidden="true" />
                                        <span className="font-mono tabular-nums text-[10px]">{punch.latitude.toFixed(3)}, {punch.longitude.toFixed(3)}</span>
                                        {punch.isGeofenceValid !== null && (
                                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
                                            {punch.isGeofenceValid ? 'Geofenced' : 'Outside'}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {punch.photoUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPhoto(punch.photoUrl)}
                                        aria-label="View punch photo verification"
                                        className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--navy-900)] hover:underline font-medium cursor-pointer ml-1"
                                      >
                                        <Camera size={12} aria-hidden="true" />
                                        <span>Photo</span>
                                      </button>
                                    )}
                                  </div>
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
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="photo-preview-title"
                    className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setSelectedPhoto(null)}
                  >
                    <div
                      className="bg-[var(--surface)] p-4 rounded-xl max-w-sm w-full space-y-3 shadow-xl border border-[var(--rule)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <h4 id="photo-preview-title" className="text-xs font-mono font-bold text-[var(--ink)]">Punch Verification Photo</h4>
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(null)}
                          aria-label="Close photo preview"
                          className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <img
                        src={selectedPhoto}
                        alt="Punch verification"
                        className="w-full h-auto rounded-lg object-cover border border-[var(--rule)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[var(--rule)] bg-[var(--paper)]/60 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                {punchList.length} swipe log{punchList.length === 1 ? '' : 's'}
              </span>

              <div className="flex items-center gap-2">
                {/* Delete Entire Day Attendance Button in Footer */}
                {canDelete && data?.totalPunches > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmDayDeleteOpen(true)}
                    disabled={isDeletingDay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--rule)] hover:border-red-300 text-xs font-mono text-[var(--ink-muted)] hover:text-red-700 hover:bg-red-50/60 dark:hover:bg-red-950/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    <span>Delete Day Attendance</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded border border-[var(--rule)] bg-[var(--surface)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--paper)] cursor-pointer transition-colors shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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
