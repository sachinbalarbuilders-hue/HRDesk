import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../context/CompanyContext';
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

  useEffect(() => {
    fetchDashboardData();
  }, [currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    const handleTenantChange = () => fetchDashboardData();
    const handleBranchChange = () => fetchDashboardData();

    window.addEventListener('hrdesk:tenant_changed', handleTenantChange);
    window.addEventListener('hrdesk:branch_changed', handleBranchChange);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleTenantChange);
      window.removeEventListener('hrdesk:branch_changed', handleBranchChange);
    };
  }, [currentOrganization?.id, currentBranch?.id]);

  const handleWebPunch = async (punchType: string) => {
    try {
      setPunching(true);
      setPunchMessage(null);
      const res = await apiClient.post('/attendance/punch', {
        employeeId: user?.employeeId,
        punchType,
        source: 'Web',
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

  if (loading) {
    return <PageSkeleton />;
  }

  const isPersonal = stats?.isPersonal;
  const metrics = stats?.metrics || {};
  const totalStaff = metrics.totalEmployees || 0;
  const presentCount = metrics.presentToday || 0;
  const leaveCount = metrics.onLeaveToday || 0;
  const absentCount = Math.max(0, totalStaff - (presentCount + leaveCount));

  return (
    <div className="space-y-6">
      {/* 1. Page Header with Display Serif and Accent Rule */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Dashboard
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Real-time attendance overview, live punches & pending approvals
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-data text-[var(--ink-muted)]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Hairline Divider with Ticks */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Horizontal Headcount Overview Strip */}
      {!isPersonal ? (
        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 w-full md:w-auto">
            {/* Total Staff */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-center text-[var(--navy-900)] dark:text-[var(--gold-500)]">
                <Users size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">
                  Total Staff
                </p>
                <p className="text-lg font-bold font-data text-[var(--ink)]">
                  {totalStaff}
                </p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-[var(--rule)] hidden sm:block" />

            {/* Present Today */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-[var(--ok-600)]/10 flex items-center justify-center text-[var(--ok-600)]">
                <UserCheck size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">
                  Present Today
                </p>
                <p className="text-lg font-bold font-data text-[var(--ok-600)]">
                  {presentCount}
                </p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-[var(--rule)] hidden sm:block" />

            {/* On Leave */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-[var(--warn-600)]/10 flex items-center justify-center text-[var(--warn-600)]">
                <CalendarOff size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">
                  On Leave
                </p>
                <p className="text-lg font-bold font-data text-[var(--warn-600)]">
                  {leaveCount}
                </p>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-[var(--rule)] hidden sm:block" />

            {/* Absent */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-[var(--err-600)]/10 flex items-center justify-center text-[var(--err-600)]">
                <UserX size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">
                  Absent / Unverified
                </p>
                <p className="text-lg font-bold font-data text-[var(--err-600)]">
                  {absentCount}
                </p>
              </div>
            </div>
          </div>

          <div className="text-xs font-data text-[var(--gold-500)] font-semibold flex items-center gap-1.5 self-end md:self-center">
            <TrendingUp size={14} />
            <span>{totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0}% Attendance Rate</span>
          </div>
        </div>
      ) : (
        /* Personal Attendance Summary */
        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)]">Payable Days (This Month)</p>
            <p className="text-xl font-bold font-data text-[var(--gold-500)]">{stats?.myAttendance?.payableDays || 0}</p>
          </div>
          <div className="h-8 w-[1px] bg-[var(--rule)]" />
          <div>
            <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)]">Present Days</p>
            <p className="text-xl font-bold font-data text-[var(--ok-600)]">{stats?.myAttendance?.presentDays || 0}</p>
          </div>
          <div className="h-8 w-[1px] bg-[var(--rule)]" />
          <div>
            <p className="text-[10px] uppercase font-semibold text-[var(--ink-muted)]">Absences (LOP)</p>
            <p className="text-xl font-bold font-data text-[var(--err-600)]">{stats?.myAttendance?.absentDays || 0}</p>
          </div>
        </div>
      )}

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Biometric Punches (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            {/* Table Section Header */}
            <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--surface-header)]">
              <div>
                <h3 className="font-semibold text-xs text-[var(--ink)] uppercase tracking-wider font-ui">
                  Today's Biometric Punch Logs
                </h3>
                <p className="text-[11px] text-[var(--ink-muted)]">Real-time terminal device telemetry</p>
              </div>
              <Link
                to="/attendance"
                className="text-xs text-[var(--gold-500)] hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Full Sheet</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* Punches Table */}
            <div className="overflow-x-auto">
              <table className="register-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th className="text-right font-data">In Time</th>
                    <th className="text-right font-data">Out Time</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentPunches?.map((punch: any, idx: number) => (
                    <tr key={idx}>
                      <td className="font-semibold text-[var(--ink)]">
                        {punch.employeeName}
                      </td>
                      <td className="text-xs text-[var(--ink-muted)]">
                        {punch.department || 'General'}
                      </td>
                      <td className="text-right font-data text-xs text-[var(--ink)]">
                        {punch.inTime || '--:--'}
                      </td>
                      <td className="text-right font-data text-xs text-[var(--ink)]">
                        {punch.outTime || '--:--'}
                      </td>
                      <td className="text-right text-xs">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <span className={punch.status === 'Present' ? 'status-dot-ok' : 'status-dot-warn'} />
                          <span className={punch.status === 'Present' ? 'text-[var(--ok-600)]' : 'text-[var(--warn-600)]'}>
                            {punch.status}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}

                  {(!stats?.recentPunches || stats.recentPunches.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs font-data text-[var(--ink-muted)]">
                        No biometric punches logged yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Pending Approvals & Web Punch (1/3) */}
        <div className="space-y-6">
          {/* Quick Web Clock-in Widget */}
          <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[var(--rule)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] font-ui">
                Web Punch Station
              </h3>
              <Clock size={14} className="text-[var(--ink-muted)]" />
            </div>

            <p className="text-xs text-[var(--ink-muted)]">
              Record manual attendance timestamp from authorized workstation.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={punching}
                onClick={() => handleWebPunch('In')}
                className="btn-primary py-2 text-center text-xs font-semibold cursor-pointer"
              >
                Punch IN
              </button>
              <button
                disabled={punching}
                onClick={() => handleWebPunch('Out')}
                className="btn-outline py-2 text-center text-xs font-semibold cursor-pointer"
              >
                Punch OUT
              </button>
            </div>

            {punchMessage && (
              <p className="text-[11px] font-data text-[var(--ok-600)] bg-[var(--ok-600)]/10 p-2 rounded-[2px] text-center">
                {punchMessage}
              </p>
            )}
          </div>

          {/* Pending Leave Authorizations */}
          {isAdmin && (
            <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--rule)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] font-ui">
                  Pending Approvals
                </h3>
                <span className="font-data text-xs text-[var(--warn-600)] font-bold">
                  {stats?.pendingLeaves?.length || 0}
                </span>
              </div>

              <div className="space-y-2.5">
                {stats?.pendingLeaves?.map((leave: any) => (
                  <div
                    key={leave.id}
                    className="p-2.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--ink)]">{leave.employeeName}</p>
                      <span className="font-data text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] bg-[var(--warn-600)]/10 text-[var(--warn-600)]">
                        {leave.leaveTypeCode}
                      </span>
                    </div>

                    <p className="text-[11px] font-data text-[var(--ink-muted)]">
                      {leave.startDate} to {leave.endDate} ({leave.totalDays}d)
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleLeaveDecision(leave.id, 'Approved')}
                        className="btn-primary flex-1 py-1 text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check size={12} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleLeaveDecision(leave.id, 'Rejected')}
                        className="btn-outline flex-1 py-1 text-[11px] flex items-center justify-center gap-1 text-[var(--err-600)] cursor-pointer"
                      >
                        <X size={12} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}

                {(!stats?.pendingLeaves || stats.pendingLeaves.length === 0) && (
                  <p className="text-xs text-[var(--ink-muted)] text-center py-4 font-data">
                    All leave applications endorsed.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
