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
  Megaphone,
  Cake,
  Award,
  Sparkles,
  Send,
  PartyPopper,
  Calendar,
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

export const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { currentOrganization, currentBranch } = useOrganization();
  const [stats, setStats] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [punchMessage, setPunchMessage] = useState<string | null>(null);

  // Wish Modal State
  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [selectedCelebrant, setSelectedCelebrant] = useState<any>(null);
  const [wishMessage, setWishMessage] = useState('');
  const [wishSent, setWishSent] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, overviewRes] = await Promise.allSettled([
        apiClient.get('/dashboard/summary', {
          params: { branchId: currentBranch?.id || undefined },
        }),
        apiClient.get('/dashboard/overview', {
          params: { branchId: currentBranch?.id || undefined },
        }),
      ]);

      if (summaryRes.status === 'fulfilled') {
        setStats(summaryRes.value.data);
      }
      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data);
      }
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

      let coords: { latitude?: number; longitude?: number } = {};
      let locationFailed = false;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 0,
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

  const openWishModal = (celebrant: any) => {
    setSelectedCelebrant(celebrant);
    const isBirthday = celebrant.type?.toLowerCase().includes('birthday');
    setWishMessage(
      isBirthday
        ? `Happy Birthday, ${celebrant.employeeName}! 🎂 Wishing you a wonderful day filled with joy and success!`
        : `Congratulations on your ${celebrant.years || 1}-year work anniversary at ${currentOrganization?.name || 'our company'}, ${celebrant.employeeName}! 🎉 Wishing you continued success!`
    );
    setWishSent(false);
    setWishModalOpen(true);
  };

  const sendWish = () => {
    setWishSent(true);
    setTimeout(() => {
      setWishModalOpen(false);
      setWishSent(false);
    }, 1600);
  };

  if (loading) return <PageSkeleton />;

  const isPersonal = stats?.isPersonal;
  const metrics = stats?.metrics || {};
  const totalStaff = metrics.totalEmployees || 0;
  const presentCount = metrics.presentToday || 0;
  const leaveCount = metrics.onLeaveToday || 0;
  const absentCount = Math.max(0, totalStaff - (presentCount + leaveCount));
  const attendanceRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

  const announcements = overview?.announcements || [];
  const celebrationsList = [
    ...(overview?.celebrations?.birthdays || []),
    ...(overview?.celebrations?.anniversaries || []),
  ];

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.fullName?.split(' ')[0] || 'there'}`}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      />

      {/* 📢 Announcements & Notices Banner */}
      {announcements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          {announcements.map((item: any, idx: number) => {
            const isHoliday = item.category?.toLowerCase().includes('holiday');
            return (
              <div
                key={idx}
                className={`relative overflow-hidden rounded-[var(--radius-lg)] p-4 border transition-all ${
                  isHoliday
                    ? 'bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-transparent border-emerald-500/30'
                    : 'bg-gradient-to-r from-sky-950/40 via-sky-900/20 to-transparent border-sky-500/30'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-[var(--radius-md)] flex-shrink-0 ${
                      isHoliday ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'
                    }`}
                  >
                    {isHoliday ? <Calendar size={18} /> : <Megaphone size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                          isHoliday ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {item.category || 'Announcement'}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-data">{item.date}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.title}</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
        {/* Left: Today's Activity & Celebrations */}
        <div className="lg:col-span-2 space-y-6">
          {/* 🎉 Celebrations & Wishes Section */}
          <Card padding="none" className="overflow-hidden border-amber-500/20">
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-950/30 via-orange-950/20 to-transparent border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                  <PartyPopper size={18} />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-amber-200">Celebrations & Milestones This Month</CardTitle>
                  <p className="text-[11px] text-[var(--text-muted)]">Birthdays & Work Anniversaries</p>
                </div>
              </div>
              <Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                {celebrationsList.length} Upcoming
              </Badge>
            </div>

            {celebrationsList.length > 0 ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {celebrationsList.map((item: any, idx: number) => {
                  const isBday = item.type?.toLowerCase().includes('birthday');
                  const isToday = item.isToday || item.day === new Date().getDate();

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-[var(--radius-md)] border transition-all ${
                        isToday
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={item.employeeName || 'E'} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{item.employeeName}</p>
                            {isToday && (
                              <span className="text-[9px] font-bold uppercase bg-amber-500 text-black px-1.5 py-0.2 rounded-full">
                                TODAY
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] mt-0.5">
                            {isBday ? (
                              <>
                                <Cake size={12} className="text-pink-400" />
                                <span>Birthday on {item.dateStr || `${item.day}th`}</span>
                              </>
                            ) : (
                              <>
                                <Award size={12} className="text-amber-400" />
                                <span>{item.years || 1} Yrs Anniversary ({item.dateStr || `${item.day}th`})</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openWishModal(item)}
                        className="px-2.5 py-1 text-xs font-medium rounded-[var(--radius-md)] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Sparkles size={11} />
                        <span>Wish</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 mb-2">
                  <Cake size={24} />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">No Celebrations This Month</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">No upcoming birthdays or work anniversaries in the active schedule.</p>
              </div>
            )}
          </Card>

          {/* Today's Activity */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <CardTitle>Today's Attendance Activity</CardTitle>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Real-time biometric & mobile logs</p>
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
                title="No punches recorded yet"
                description="Activity logs will appear here as employees clock in."
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
          {isAdmin && stats?.pendingApprovals?.length > 0 && (
            <Card padding="none">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <CardTitle>Pending Approvals</CardTitle>
                  <Badge variant="danger">{stats.pendingApprovals.length}</Badge>
                </div>
                <Link to="/leaves" className="text-xs font-medium text-[var(--accent)] hover:underline">
                  View all
                </Link>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {stats.pendingApprovals.slice(0, 5).map((leave: any) => (
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

      {/* 🎉 Send Wish Modal */}
      {wishModalOpen && selectedCelebrant && (
        <Modal
          isOpen={wishModalOpen}
          onClose={() => setWishModalOpen(false)}
          title={`Send Wishes to ${selectedCelebrant.employeeName}`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20">
              <Avatar name={selectedCelebrant.employeeName || 'E'} size="md" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedCelebrant.employeeName}</p>
                <p className="text-xs text-amber-300">
                  {selectedCelebrant.type?.toLowerCase().includes('birthday')
                    ? '🎂 Birthday Celebration'
                    : `🎉 ${selectedCelebrant.years || 1}-Year Work Anniversary`}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Personalize Your Message
              </label>
              <textarea
                value={wishMessage}
                onChange={(e) => setWishMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>

            {wishSent ? (
              <div className="p-3 text-center rounded-[var(--radius-md)] bg-emerald-500/15 text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2">
                <Check size={16} /> Wish sent successfully!
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWishModalOpen(false)}
                  className="btn-secondary px-4 py-2 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendWish}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Send size={14} /> Send Wish
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
