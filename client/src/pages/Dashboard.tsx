import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/CompanyContext';
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
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/PageSkeleton';

export const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { currentOrganization, currentBranch } = useOrganization();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [punchMessage, setPunchMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/dashboard/summary', {
        params: { branchId: currentBranch?.id || undefined }
      });
      setStats(res.data);
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

  const handleWebPunch = async (punchType: string) => {
    try {
      setPunching(true);
      setPunchMessage(null);

      // Attempt to retrieve GPS coordinates for Geo-Fencing enforcement.
      // Timeout is 15s — desktop GPS (via WiFi/IP) can take longer than mobile.
      let coords: { latitude?: number; longitude?: number } = {};
      let locationFailed = false;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,  // false = faster WiFi/IP location, works on desktops
              timeout: 15000,
              maximumAge: 0,              // always fresh — don't use cached position
            });
          });
          coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        } catch {
          locationFailed = true;
        }
      }

      if (locationFailed) {
        // Tell the user clearly instead of silently submitting without coords
        // (the backend will reject if the employee's attendance type requires GPS)
        setPunchMessage('Could not get your location. Please ensure location access is allowed for this site and try again.');
        return;
      }

      const res = await apiClient.post('/attendance/punch', {
        employeeId: user?.employeeId,
        punchType,
        source: 'Web',
        ...coords,
      });
      setPunchMessage(res.data.message || 'Punch logged successfully.');
      fetchDashboardData();
    } catch (err: any) {
      setPunchMessage(err.response?.data?.message || 'Failed to record punch.');
    } finally {
      setPunching(false);
    }
  };

  const handleLeaveDecision = async (id: number, status: string) => {
    try {
      await apiClient.put(`/leaves/${id}/status`, { status });
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to process leave', err);
    }
  };

  if (loading) return <PageSkeleton />;

  const isPersonal = stats?.isPersonal;
  const metrics = stats?.metrics || {};
  const totalStaff = metrics.totalEmployees || 0;
  const presentCount = metrics.presentToday || 0;
  const leaveCount = metrics.onLeaveToday || 0;
  const absentCount = Math.max(0, totalStaff - (presentCount + leaveCount));
  const attendanceRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.fullName?.split(' ')[0] || 'there'}`}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      />

      {/* KPI Stats Grid */}
      {!isPersonal ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Employees"
            value={totalStaff}
            icon={<Users size={20} />}
            variant="default"
            subtitle="Active headcount"
          />
          <StatCard
            label="Present Today"
            value={presentCount}
            icon={<UserCheck size={20} />}
            variant="success"
            trend={{ value: attendanceRate, label: 'rate' }}
          />
          <StatCard
            label="On Leave"
            value={leaveCount}
            icon={<CalendarOff size={20} />}
            variant="warning"
          />
          <StatCard
            label="Absent"
            value={absentCount}
            icon={<UserX size={20} />}
            variant="danger"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Payable Days"
            value={stats?.myAttendance?.payableDays || 0}
            icon={<TrendingUp size={20} />}
            variant="default"
            subtitle="This month"
          />
          <StatCard
            label="Present Days"
            value={stats?.myAttendance?.presentDays || 0}
            icon={<UserCheck size={20} />}
            variant="success"
          />
          <StatCard
            label="Absences (LOP)"
            value={stats?.myAttendance?.absentDays || 0}
            icon={<UserX size={20} />}
            variant="danger"
          />
        </div>
      )}

      {/* Main Grid: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Today's Punch Logs */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <CardTitle>Today's Activity</CardTitle>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Real-time biometric logs</p>
              </div>
              <Link to="/attendance" className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {stats?.recentPunches?.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {stats.recentPunches.map((punch: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-hover)]">
                    <Avatar name={punch.employeeName || 'E'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{punch.employeeName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{punch.department || 'General'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-data text-[var(--text-primary)]">
                        {punch.inTime || '--:--'} → {punch.outTime || '--:--'}
                      </p>
                    </div>
                    <Badge variant={punch.status === 'Present' ? 'success' : 'warning'} dot>
                      {punch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No punches yet"
                description="Biometric logs will appear here as employees clock in."
                icon={<Clock size={24} className="text-[var(--text-muted)]" />}
              />
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Web Punch Widget */}
          <Card>
            <CardTitle>Quick Punch</CardTitle>
            <p className="text-xs text-[var(--text-secondary)] mt-1 mb-4">Record attendance from browser</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={punching}
                onClick={() => handleWebPunch('In')}
                className="btn-primary py-3 text-center text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                Punch IN
              </button>
              <button
                disabled={punching}
                onClick={() => handleWebPunch('Out')}
                className="btn-secondary py-3 text-center text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                Punch OUT
              </button>
            </div>

            {punchMessage && (
              <p className="text-xs text-[var(--accent)] mt-3 text-center font-medium">{punchMessage}</p>
            )}
          </Card>

          {/* Pending Approvals */}
          {isAdmin && stats?.pendingLeaves?.length > 0 && (
            <Card padding="none">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <CardTitle>Pending Approvals</CardTitle>
                  <Badge variant="danger">{stats.pendingLeaves.length}</Badge>
                </div>
                <Link to="/leaves" className="text-xs font-medium text-[var(--accent)] hover:underline">
                  View all
                </Link>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {stats.pendingLeaves.slice(0, 5).map((leave: any) => (
                  <div key={leave.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={leave.employeeName || 'E'} size="xs" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{leave.employeeName}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{leave.leaveType} · {leave.days} day(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleLeaveDecision(leave.id, 'Approved')}
                        className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center hover:opacity-80 cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleLeaveDecision(leave.id, 'Rejected')}
                        className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--danger-light)] text-[var(--danger)] flex items-center justify-center hover:opacity-80 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Links */}
          <Card>
            <CardTitle>Quick Links</CardTitle>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Monthly Payroll', href: '/payroll', icon: <CreditCard size={15} /> },
                { label: 'Leave Applications', href: '/leaves', icon: <FileText size={15} /> },
                { label: 'Regularizations', href: '/regularizations', icon: <AlertCircle size={15} /> },
              ].map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
                >
                  <span className="text-[var(--accent)]">{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                  <ArrowRight size={13} className="ml-auto text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};
