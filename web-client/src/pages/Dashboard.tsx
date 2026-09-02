import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/CompanyContext';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  CalendarOff,
  Clock,
  Check,
  X,
  ArrowRight,
  TrendingUp,
  CreditCard,
  FileText,
  AlertCircle,
  Megaphone,
  Cake,
  Award,
  Sparkles,
  Send,
  PartyPopper,
  Calendar,
  ClipboardList,
  Banknote,
  UserPlus,
  Building2,
  LogIn,
  LogOut,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardTitle } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { Modal } from '../components/ui/Modal';

// ─── Web Clock / Quick Punch Widget ─────────────────────────────
const WebClockWidget: React.FC<{
  todayAttendance?: any;
  onPunchSuccess: () => void;
}> = ({ todayAttendance, onPunchSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [punching, setPunching] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const inTime = todayAttendance?.inTime && todayAttendance.inTime !== '--:--' ? todayAttendance.inTime : null;
  const outTime = todayAttendance?.outTime && todayAttendance.outTime !== '--:--' ? todayAttendance.outTime : null;
  const isClockedIn = Boolean(inTime && !outTime);
  const isClockedOut = Boolean(inTime && outTime);
  const status = todayAttendance?.status || (isClockedIn ? 'Present' : isClockedOut ? 'Clocked Out' : 'Not Checked In');
  const shiftName = todayAttendance?.shiftName || 'General Shift';

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const handlePunch = async () => {
    try {
      setPunching(true);
      const punchType = isClockedIn ? 'out' : 'in';

      let coords: { latitude?: number; longitude?: number } = {};
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch {
          // ignore geolocation failures on desktop
        }
      }

      const res = await apiClient.post('/attendance/punch', {
        punchType,
        source: 'Web',
        ...coords,
      });

      showSuccess(
        isClockedIn ? 'Clocked Out' : 'Clocked In',
        res.data?.message || (isClockedIn ? 'You have clocked out successfully.' : 'You have clocked in successfully.')
      );
      onPunchSuccess();
    } catch (err: any) {
      showError('Clock-In Failed', err?.response?.data?.message || 'Failed to record attendance');
    } finally {
      setPunching(false);
    }
  };

  return (
    <Card className="relative overflow-hidden border border-[var(--border)] bg-gradient-to-br from-[var(--surface-primary)] to-[var(--surface-secondary)]/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Live Time & Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0 shadow-xs">
            <Clock size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-bold font-data text-[var(--text-primary)] tracking-tight">
                {timeString}
              </span>
              <Badge
                variant={isClockedIn ? 'success' : isClockedOut ? 'neutral' : 'warning'}
                dot
              >
                {status}
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {dateString} • <span className="font-medium text-[var(--text-primary)]">{shiftName}</span>
            </p>
          </div>
        </div>

        {/* Center: Punch In & Out Metrics */}
        <div className="flex items-center justify-center gap-6 px-4 py-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-center text-xs">
          <div>
            <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">Punch In</p>
            <p className="font-bold font-data text-[var(--text-primary)] text-sm">{inTime || '--:--'}</p>
          </div>
          <div className="w-px h-6 bg-[var(--border)]" />
          <div>
            <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">Punch Out</p>
            <p className="font-bold font-data text-[var(--text-primary)] text-sm">{outTime || '--:--'}</p>
          </div>
        </div>

        {/* Right: Clock In / Clock Out Button */}
        <div>
          <button
            type="button"
            onClick={handlePunch}
            disabled={punching}
            className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isClockedIn
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-rose-500/20'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-500/20'
            }`}
          >
            {punching ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Recording...</span>
              </>
            ) : isClockedIn ? (
              <>
                <LogOut size={15} />
                <span>Clock Out</span>
              </>
            ) : (
              <>
                <LogIn size={15} />
                <span>{isClockedOut ? 'Clock In Again' : 'Clock In'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
};

// ─── Tab Button ───────────────────────────────────────────────
const TabButton: React.FC<{ active: boolean; label: string; count?: number; onClick: () => void }> = ({ active, label, count, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] cursor-pointer transition-all ${
      active
        ? 'bg-[var(--accent)] text-white'
        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
    }`}
  >
    {label}
    {typeof count === 'number' && count > 0 && (
      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
        active ? 'bg-white/20' : 'bg-[var(--danger-light)] text-[var(--danger)]'
      }`}>
        {count}
      </span>
    )}
  </button>
);

export const Dashboard: React.FC = () => {
  const { user, isAdmin, hasPermission, getPermissionScope } = useAuth();
  const { currentOrganization, currentBranch } = useOrganization();
  const [stats, setStats] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaves' | 'regularizations' | 'loans'>('leaves');

  // Wish Modal State
  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [selectedCelebrant, setSelectedCelebrant] = useState<any>(null);
  const [wishMessage, setWishMessage] = useState('');
  const [wishSent, setWishSent] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, overviewRes] = await Promise.allSettled([
        apiClient.get('/dashboard/summary', { params: { branchId: currentBranch?.id || undefined } }),
        apiClient.get('/dashboard/overview', { params: { branchId: currentBranch?.id || undefined } }),
      ]);
      if (summaryRes.status === 'fulfilled') setStats(summaryRes.value.data);
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, [currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    const handleReload = () => fetchDashboardData();
    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [currentOrganization?.id, currentBranch?.id]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleLeaveDecision = async (id: number, status: string) => {
    try { await apiClient.put(`/leaves/${id}/status`, { status }); fetchDashboardData(); } catch {}
  };

  const handleRegularizationDecision = async (id: number, status: string) => {
    try { await apiClient.put(`/regularizations/${id}/status`, { status }); fetchDashboardData(); } catch {}
  };

  const openWishModal = (celebrant: any) => {
    setSelectedCelebrant(celebrant);
    const isBirthday = celebrant.type?.toLowerCase().includes('birthday');
    setWishMessage(
      isBirthday
        ? `Happy Birthday, ${celebrant.employeeName}! 🎂 Wishing you a wonderful day!`
        : `Congratulations on your ${celebrant.years || 1}-year work anniversary, ${celebrant.employeeName}! 🎉`
    );
    setWishSent(false);
    setWishModalOpen(true);
  };

  const sendWish = () => {
    setWishSent(true);
    setTimeout(() => { setWishModalOpen(false); setWishSent(false); }, 1600);
  };

  if (loading) return <PageSkeleton />;

  const dashboardScope = stats?.scope || getPermissionScope('Dashboard.View') || getPermissionScope('Employees.View') || (isAdmin ? 'All' : 'Own');
  const isPersonal = stats?.isPersonal || (dashboardScope === 'Own' && !isAdmin);
  const metrics = stats?.metrics || {};

  const canViewAttendance = isAdmin || hasPermission('Attendance.View');
  const canApproveLeaves = isAdmin || hasPermission('Leaves.Approve');
  const canApproveRegs = isAdmin || hasPermission('Regularizations.Approve');
  const canManageLoans = isAdmin || hasPermission('Payroll.ManageLoans') || hasPermission('Payroll.View');

  // Dynamic scope label
  const headcountLabel =
    dashboardScope === 'Reporting To' ? 'My Team Members' :
    dashboardScope === 'Department' ? 'Department Staff' :
    dashboardScope === 'Own Branch' ? 'Branch Staff' : 'Total Employees';

  const headcountSubtitle =
    dashboardScope === 'Reporting To' ? 'Direct reportees' :
    dashboardScope === 'Department' ? 'Active in department' :
    dashboardScope === 'Own Branch' ? 'Branch headcount' : 'Active headcount';

  // ─── EMPLOYEE SELF-SERVICE VIEW ─────────────────────────────
  if (isPersonal) {
    return (
      <PageContainer>
        <PageHeader
          title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.fullName?.split(' ')[0] || 'there'}`}
          description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        />

        {/* Clock In / Out Widget */}
        <WebClockWidget
          todayAttendance={stats?.todayAttendance}
          onPunchSuccess={fetchDashboardData}
        />

        {/* Leave Balance + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardTitle>Leave Balance</CardTitle>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(stats?.leaveBalances || []).slice(0, 4).map((lb: any, idx: number) => (
                <div key={idx} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] text-center">
                  <p className="text-lg font-bold font-data text-[var(--text-primary)]">{lb.balance}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{lb.leaveType}</p>
                </div>
              ))}
              {(!stats?.leaveBalances || stats.leaveBalances.length === 0) && (
                <p className="col-span-2 text-xs text-[var(--text-muted)] text-center py-4">No allocations yet</p>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Present Days" value={metrics.monthPresentDays || 0} icon={<UserCheck size={20} />} variant="success" subtitle="This month" />
            <StatCard label="Pending Leaves" value={metrics.pendingLeaves || 0} icon={<FileText size={20} />} variant="warning" />
          </div>
        </div>

        {overview?.announcements?.length > 0 && (
          <Card padding="none">
            <div className="px-5 py-3.5 border-b border-[var(--border)]">
              <CardTitle>Notices</CardTitle>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {overview.announcements.slice(0, 3).map((a: any, idx: number) => (
                <div key={idx} className="px-5 py-3">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{a.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{a.message}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick Links */}
        <Card>
          <CardTitle>Quick Links</CardTitle>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Apply Leave', href: '/leaves', icon: <FileText size={14} /> },
              { label: 'Attendance', href: '/attendance', icon: <Clock size={14} /> },
              { label: 'Payslip', href: '/payroll', icon: <CreditCard size={14} /> },
              { label: 'Regularization', href: '/regularizations', icon: <ClipboardList size={14} /> },
            ].map((link) => (
              <Link key={link.href} to={link.href} className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]">
                <span className="text-[var(--accent)]">{link.icon}</span>
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  // ─── ADMIN / MANAGER VIEW ──────────────────────────────────
  const totalStaff = metrics.totalEmployees || 0;
  const presentCount = metrics.presentToday || 0;
  const leaveCount = metrics.onLeaveToday || 0;
  const absentCount = Math.max(0, totalStaff - (presentCount + leaveCount));
  const attendanceRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  const pendingLeaves = stats?.pendingApprovals || [];
  const pendingRegs = stats?.pendingRegularizations || [];
  const pendingLoansData = stats?.pendingLoans || [];
  const onLeaveTodayList = stats?.onLeaveToday || [];
  const departmentCounts: { name: string; count: number }[] = stats?.departmentCounts || [];

  const announcements = overview?.announcements || [];
  const celebrationsList = [
    ...(overview?.celebrations?.birthdays || []),
    ...(overview?.celebrations?.anniversaries || []),
  ];
  const newJoiners = overview?.celebrations?.newJoiners || [];

  // Department chart: compute max for bar width
  const maxDeptCount = Math.max(1, ...departmentCounts.map((d) => d.count));

  // Pending requests summary
  const pendingRequestItems = [
    { label: 'Leave Requests', count: pendingLeaves.length, href: '/leaves', icon: <CalendarOff size={14} /> },
    { label: 'Attendance Corrections', count: pendingRegs.length, href: '/regularizations', icon: <ClipboardList size={14} /> },
    { label: 'Loan / Advance Requests', count: pendingLoansData.length, href: '/loans', icon: <Banknote size={14} /> },
  ];
  const totalPendingCount = pendingRequestItems.reduce((sum, r) => sum + r.count, 0);

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.fullName?.split(' ')[0] || 'there'}`}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      />

      {/* ── Web Clock / Quick Punch ── */}
      {stats?.todayAttendance && (
        <WebClockWidget
          todayAttendance={stats.todayAttendance}
          onPunchSuccess={fetchDashboardData}
        />
      )}

      {/* ── Row 1: KPI Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={headcountLabel} value={totalStaff} icon={<Users size={20} />} variant="default" subtitle={headcountSubtitle} />
        <StatCard label="Present Today" value={presentCount} icon={<UserCheck size={20} />} variant="success" trend={{ value: attendanceRate, label: 'rate' }} />
        <StatCard label="On Leave" value={leaveCount} icon={<CalendarOff size={20} />} variant="warning" />
        <StatCard label="Absent" value={absentCount} icon={<UserX size={20} />} variant="danger" />
      </div>

      {/* ── Row 2: Today's Attendance + Pending Requests ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Today's Attendance — 3/5 */}
        {canViewAttendance && (
        <Card padding="none" className="lg:col-span-3">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div>
              <CardTitle>Today's Attendance</CardTitle>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Real-time punch logs</p>
            </div>
            <Link to="/attendance" className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {stats?.recentPunches?.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {stats.recentPunches.slice(0, 8).map((punch: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar name={punch.employeeName || 'E'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{punch.employeeName}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{punch.department}</p>
                  </div>
                  <p className="text-[11px] font-data text-[var(--text-secondary)]">{punch.inTime} → {punch.outTime}</p>
                  <Badge variant={punch.status === 'Present' ? 'success' : punch.isLate ? 'warning' : 'neutral'} dot>{punch.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No punches yet" description="Activity will appear as employees clock in." icon={<Clock size={24} className="text-[var(--text-muted)]" />} />
          )}
        </Card>
        )}

        {/* Pending Requests — 2/5 */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Pending Requests</CardTitle>
            {totalPendingCount > 0 && <Badge variant="danger">{totalPendingCount}</Badge>}
          </div>
          <div className="space-y-2">
            {pendingRequestItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--border)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[var(--accent)]">{item.icon}</span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.count > 0 ? (
                    <Badge variant="danger">{item.count}</Badge>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">0</span>
                  )}
                  <ArrowRight size={12} className="text-[var(--text-muted)]" />
                </div>
              </Link>
            ))}
          </div>

          {/* On Leave Today mini-list */}
          {onLeaveTodayList.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">On Leave Today</p>
                <Badge variant="warning">{onLeaveTodayList.length}</Badge>
              </div>
              <div className="space-y-2">
                {onLeaveTodayList.slice(0, 4).map((emp: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <Avatar name={emp.employeeName || 'E'} size="xs" />
                    <span className="text-[11px] text-[var(--text-primary)] truncate flex-1">{emp.employeeName}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{emp.leaveType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Department Distribution + New Joiners ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Department Distribution — 3/5 */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[var(--accent)]" />
              <CardTitle>Department Distribution</CardTitle>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">{totalStaff} total</span>
          </div>
          {departmentCounts.length > 0 ? (
            <div className="flex items-center gap-8">
              {/* Donut Chart */}
              <div className="relative flex-shrink-0">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  {(() => {
                    const colors = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                    let accumulated = 0;
                    const radius = 60;
                    const cx = 80, cy = 80;
                    const circumference = 2 * Math.PI * radius;
                    return departmentCounts.map((dept, idx) => {
                      const pct = totalStaff > 0 ? dept.count / totalStaff : 0;
                      const dashLength = pct * circumference;
                      const dashOffset = -accumulated * circumference;
                      accumulated += pct;
                      return (
                        <circle
                          key={idx}
                          cx={cx}
                          cy={cy}
                          r={radius}
                          fill="none"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="24"
                          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                          strokeDashoffset={dashOffset}
                          transform={`rotate(-90 ${cx} ${cy})`}
                        />
                      );
                    });
                  })()}
                  <text x="80" y="76" textAnchor="middle" className="fill-[var(--text-primary)]" fontSize="20" fontWeight="700">{totalStaff}</text>
                  <text x="80" y="94" textAnchor="middle" className="fill-[var(--text-muted)]" fontSize="11">employees</text>
                </svg>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2.5">
                {departmentCounts.map((dept, idx) => {
                  const colors = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                  const pct = totalStaff > 0 ? Math.round((dept.count / totalStaff) * 100) : 0;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                      <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{dept.name}</span>
                      <span className="text-xs font-data font-semibold text-[var(--text-primary)]">{dept.count}</span>
                      <span className="text-[10px] text-[var(--text-muted)] w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center py-6">No department data available</p>
          )}
        </Card>

        {/* New Joiners — 2/5 */}
        <Card padding="none" className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-[var(--accent)]" />
              <CardTitle>New Joiners</CardTitle>
            </div>
            {newJoiners.length > 3 && (
              <Link to="/employees" className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5">
                View all <ArrowRight size={10} />
              </Link>
            )}
          </div>
          {newJoiners.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {newJoiners.slice(0, 4).map((nj: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={nj.employeeName || 'E'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{nj.employeeName}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{nj.department}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-data">{nj.dateStr}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-[var(--text-muted)]">No recent joiners</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Pending Actions (Tabbed — detailed) + Announcements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pending Actions Detailed — 3/5 */}
        {(pendingLeaves.length > 0 || pendingRegs.length > 0 || pendingLoansData.length > 0) && (
          <Card padding="none" className="lg:col-span-3">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <CardTitle>Pending Actions</CardTitle>
              <div className="flex items-center gap-1">
                <TabButton active={activeTab === 'leaves'} label="Leaves" count={pendingLeaves.length} onClick={() => setActiveTab('leaves')} />
                <TabButton active={activeTab === 'regularizations'} label="Corrections" count={pendingRegs.length} onClick={() => setActiveTab('regularizations')} />
                <TabButton active={activeTab === 'loans'} label="Loans" count={pendingLoansData.length} onClick={() => setActiveTab('loans')} />
              </div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {activeTab === 'leaves' && (
                pendingLeaves.length > 0 ? pendingLeaves.map((leave: any) => (
                  <div key={leave.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={leave.employeeName || 'E'} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{leave.employeeName}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{leave.leaveType} · {leave.days}d · {leave.startDate}</p>
                      </div>
                    </div>
                    {canApproveLeaves && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => handleLeaveDecision(leave.id, 'Approved')} className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center hover:opacity-80 cursor-pointer"><Check size={14} /></button>
                      <button onClick={() => handleLeaveDecision(leave.id, 'Rejected')} className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--danger-light)] text-[var(--danger)] flex items-center justify-center hover:opacity-80 cursor-pointer"><X size={14} /></button>
                    </div>
                    )}
                    {!canApproveLeaves && <Link to="/leaves" className="text-xs text-[var(--accent)] hover:underline font-medium">View</Link>}
                  </div>
                )) : <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">No pending leave requests</div>
              )}
              {activeTab === 'regularizations' && (
                pendingRegs.length > 0 ? pendingRegs.map((reg: any) => (
                  <div key={reg.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={reg.employeeName || 'E'} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{reg.employeeName}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{reg.type} · {reg.requestDate}</p>
                      </div>
                    </div>
                    {canApproveRegs && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => handleRegularizationDecision(reg.id, 'Approved')} className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center hover:opacity-80 cursor-pointer"><Check size={14} /></button>
                      <button onClick={() => handleRegularizationDecision(reg.id, 'Rejected')} className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--danger-light)] text-[var(--danger)] flex items-center justify-center hover:opacity-80 cursor-pointer"><X size={14} /></button>
                    </div>
                    )}
                    {!canApproveRegs && <Link to="/regularizations" className="text-xs text-[var(--accent)] hover:underline font-medium">View</Link>}
                  </div>
                )) : <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">No pending corrections</div>
              )}
              {activeTab === 'loans' && (
                pendingLoansData.length > 0 ? pendingLoansData.map((loan: any) => (
                  <div key={loan.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={loan.employeeName || 'E'} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{loan.employeeName}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{loan.loanType} · ₹{loan.amount?.toLocaleString()}</p>
                      </div>
                    </div>
                    {canManageLoans && <Link to={`/loans/${loan.id}`} className="text-xs text-[var(--accent)] hover:underline font-medium">View</Link>}
                  </div>
                )) : <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">No pending loan requests</div>
              )}
            </div>
          </Card>
        )}

        {/* Announcements + Celebrations — 2/5 */}
        <div className={`space-y-6 ${(pendingLeaves.length > 0 || pendingRegs.length > 0 || pendingLoansData.length > 0) ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
          {/* Announcements */}
          {announcements.length > 0 && (
            <Card padding="none">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
                <CardTitle>Announcements</CardTitle>
                <Link to="/announcements" className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5">
                  View all <ArrowRight size={10} />
                </Link>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {announcements.slice(0, 3).map((item: any, idx: number) => {
                  const isHoliday = item.category?.toLowerCase().includes('holiday');
                  return (
                    <div key={idx} className="flex items-start gap-3 px-5 py-3">
                      {item.imagePath ? (
                        <img src={item.imagePath} alt="" className="w-12 h-12 rounded-[var(--radius-md)] object-cover flex-shrink-0 border border-[var(--border)]" />
                      ) : item.videoPath ? (
                        <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--accent)]"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                      ) : (
                        <div className={`p-1.5 rounded-[var(--radius-md)] flex-shrink-0 mt-0.5 ${isHoliday ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--info-light)] text-[var(--info)]'}`}>
                          {isHoliday ? <Calendar size={12} /> : <Megaphone size={12} />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* ── Row 5: Celebrations Carousel ── */}
      {celebrationsList.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Team Celebrations</CardTitle>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{celebrationsList.length} upcoming events</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { const el = document.getElementById('celebrations-scroll'); if (el) el.scrollBy({ left: -280, behavior: 'smooth' }); }}
                className="w-7 h-7 rounded-[var(--radius-md)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-secondary)] cursor-pointer text-[var(--text-muted)]"
              >
                <ArrowRight size={14} className="rotate-180" />
              </button>
              <button
                onClick={() => { const el = document.getElementById('celebrations-scroll'); if (el) el.scrollBy({ left: 280, behavior: 'smooth' }); }}
                className="w-7 h-7 rounded-[var(--radius-md)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-secondary)] cursor-pointer text-[var(--text-muted)]"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div id="celebrations-scroll" className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {celebrationsList.map((item: any, idx: number) => {
              const isBday = item.type?.toLowerCase().includes('birthday');
              const daysLeft = item.daysUntil ?? 0;
              const birthdayMessages = [
                "Wishing you a year filled with growth, success, and happiness in everything you do!",
                "May this year bring groundbreaking achievements, limitless growth, and the fulfillment of your highest ambitions!",
                "Here's to celebrating your unique impact today and unlocking even greater opportunities in the year to come!",
                "May your special day be as wonderful as the energy you bring to the team every single day!",
                "Cheers to another year of making a difference — your dedication inspires us all!",
              ];
              const anniversaryMessages = [
                "Your momentum is inspiring; keep mastering your craft, breaking barriers, and setting new benchmarks!",
                "Thank you for your dedication and hard work. Your contribution makes a real difference every day!",
                "Congratulations on this milestone! Your commitment and passion drive our team forward!",
                "Your journey with us has been remarkable. Here's to many more years of shared success!",
                "Every year you grow stronger. Your resilience and work ethic are truly admirable!",
              ];
              const messages = isBday ? birthdayMessages : anniversaryMessages;
              const message = messages[idx % messages.length];

              return (
                <div
                  key={idx}
                  className="flex-shrink-0 w-64 p-4 rounded-[var(--radius-lg)] bg-[var(--surface-secondary)] border border-[var(--border)] text-center flex flex-col"
                >
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <Avatar name={item.employeeName || 'E'} size="lg" />
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                        {isBday ? <Cake size={12} className="text-[var(--danger)]" /> : <Award size={12} className="text-[var(--warning)]" />}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{item.employeeName}</p>
                  <Badge variant={isBday ? 'danger' : 'warning'} size="sm" className="mt-1.5 mx-auto">
                    {isBday ? '🎂 Birthday' : `🎉 ${item.years || 1}yr Anniversary`}
                  </Badge>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-3 leading-relaxed italic line-clamp-3 flex-1">"{message}"</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                    <span className="text-[11px] text-[var(--text-muted)] font-data">{item.dateStr}</span>
                    {item.isToday ? (
                      <Badge variant="success" size="sm">Today!</Badge>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--accent)]">{daysLeft} days left</span>
                    )}
                  </div>
                  <button
                    onClick={() => openWishModal(item)}
                    className="mt-3 w-full py-1.5 text-xs font-medium rounded-[var(--radius-md)] border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles size={12} /> Send Wish
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Wish Modal ── */}
      {wishModalOpen && selectedCelebrant && (
        <Modal isOpen={wishModalOpen} onClose={() => setWishModalOpen(false)} title={`Send Wishes to ${selectedCelebrant.employeeName}`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)]">
              <Avatar name={selectedCelebrant.employeeName || 'E'} size="md" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedCelebrant.employeeName}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedCelebrant.type?.toLowerCase().includes('birthday') ? '🎂 Birthday' : `🎉 ${selectedCelebrant.years || 1}-Year Anniversary`}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Your Message</label>
              <textarea
                value={wishMessage}
                onChange={(e) => setWishMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
            {wishSent ? (
              <div className="p-3 text-center rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] text-sm font-semibold flex items-center justify-center gap-2">
                <Check size={16} /> Wish sent!
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setWishModalOpen(false)} className="btn-secondary px-4 py-2 text-sm cursor-pointer">Cancel</button>
                <button type="button" onClick={sendWish} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 cursor-pointer"><Send size={14} /> Send</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
