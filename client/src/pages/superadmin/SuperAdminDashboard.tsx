import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PlansTab } from './PlansTab';
import { BillingTab } from './BillingTab';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Calendar,
  Search,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Receipt,
  X,
  Layers,
  ArrowLeft,
  ShieldCheck,
  Lock,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalEmployees: number;
  totalMRR: number;
  totalARR: number;
  totalCollectedRevenue: number;
  thisMonthRevenue: number;
  planDistribution: { planName: string; count: number }[];
}

interface TenantItem {
  id: number;
  publicId: string;
  name: string;
  code?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  isActive: boolean;
  createdAt: string;
  planName: string;
  planCode: string;
  subscriptionStatus: string;
  validUntil?: string;
  employeeCount: number;
  branchCount: number;
  maxEmployees: number;
  maxBranches: number;
}

type TabKey = 'tenants' | 'plans' | 'billing';
type StatusFilter = 'all' | 'active' | 'trialing' | 'suspended';

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'suspended', label: 'Suspended' },
];

/* ─── Component ─────────────────────────────────────────── */

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('tenants');

  // Loading States
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // Data States
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  // Pagination & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [extendModalTenant, setExtendModalTenant] = useState<TenantItem | null>(null);
  const [extendDays, setExtendDays] = useState(14);
  const [extending, setExtending] = useState(false);

  const [overrideModalTenant, setOverrideModalTenant] = useState<TenantItem | null>(null);
  const [overridePlanId, setOverridePlanId] = useState<number | null>(null);
  const [overriding, setOverriding] = useState(false);

  /* ─── Data Fetching ───────────────────────────────────── */

  const fetchMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const res = await apiClient.get('/superadmin/metrics');
      setMetrics(res.data);
    } catch (err: any) {
      console.error('Failed to load metrics', err);
      showError('Access Denied', 'SuperAdmin privileges are required to view this portal.');
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchTenants = async () => {
    try {
      setLoadingTenants(true);
      const res = await apiClient.get('/superadmin/tenants', {
        params: {
          page,
          pageSize: 15,
          search: search.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setTenants(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load tenants', err);
    } finally {
      setLoadingTenants(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await apiClient.get('/superadmin/plans');
      setPlans(res.data || []);
    } catch (err) {
      console.error('Failed to load plans', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchPlans();
  }, []);

  useEffect(() => {
    if (activeTab === 'tenants') {
      fetchTenants();
    }
  }, [activeTab, page, statusFilter]);

  /* ─── Handlers ────────────────────────────────────────── */

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTenants();
  };

  const handleExtendTrial = async () => {
    if (!extendModalTenant) return;
    try {
      setExtending(true);
      const res = await apiClient.post(`/superadmin/tenants/${extendModalTenant.id}/extend-trial`, {
        days: extendDays,
      });
      showSuccess('Trial Extended', res.data.message || `Added ${extendDays} days.`);
      setExtendModalTenant(null);
      await fetchTenants();
    } catch (err: any) {
      showError('Action Failed', err.response?.data?.message || 'Could not extend trial.');
    } finally {
      setExtending(false);
    }
  };

  const handleOverridePlan = async () => {
    if (!overrideModalTenant || !overridePlanId) return;
    try {
      setOverriding(true);
      const res = await apiClient.post(`/superadmin/tenants/${overrideModalTenant.id}/override-plan`, {
        planId: overridePlanId,
      });
      showSuccess('Plan Overridden', res.data.message || 'Updated tenant plan tier.');
      setOverrideModalTenant(null);
      await fetchTenants();
      await fetchMetrics();
    } catch (err: any) {
      showError('Action Failed', err.response?.data?.message || 'Could not update plan.');
    } finally {
      setOverriding(false);
    }
  };

  const handleToggleTenantStatus = async (tenant: TenantItem) => {
    try {
      const res = await apiClient.post(`/superadmin/tenants/${tenant.id}/toggle-status`);
      showSuccess('Status Updated', res.data.message);
      await fetchTenants();
    } catch (err: any) {
      showError('Action Failed', err.response?.data?.message || 'Could not toggle tenant status.');
    }
  };

  /* ─── Access Denied ───────────────────────────────────── */

  if (user && user.role !== 'SuperAdmin' && user.role !== 'Super Admin') {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-6 text-center font-ui">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
          <Lock size={32} />
        </div>
        <h2 className="font-display text-2xl font-bold text-[var(--text-primary)] mb-2">Restricted Access</h2>
        <p className="text-sm text-[var(--text-primary)]/60 max-w-md mb-6">
          Platform SuperAdmin credentials are required to access this portal. Your account does not have platform-level clearance.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary py-2 px-6 text-xs font-semibold cursor-pointer"
        >
          Return to HRMS Workspace
        </button>
      </div>
    );
  }

  /* ─── Render ──────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col text-[var(--text-primary)]">
      {/* ── Top Navbar ──────────────────────────────────── */}
      <header className="bg-[var(--navy-900)] text-white border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--gold-500)] text-[var(--navy-900)] flex items-center justify-center font-bold">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base tracking-tight text-white">
                HRDesk<span className="text-[var(--gold-500)] text-xs ml-1 font-mono">PLATFORM CONSOLE</span>
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-rose-500 text-white">
                SuperAdmin
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Global Multi-Tenant Infrastructure &amp; Overrides</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Return to Tenant HRMS</span>
          </button>

          <button
            onClick={() => {
              fetchMetrics();
              if (activeTab === 'tenants') fetchTenants();
            }}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Refresh Platform Metrics"
          >
            <RefreshCw size={14} className={loadingMetrics ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* ── Main Container ─────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 font-ui">

        {/* ── KPI Metric Cards ─────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MRR */}
          <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-primary)]/60">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Monthly Recurring (MRR)</span>
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {'\u20B9'}{(metrics?.totalMRR ?? 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-[var(--text-primary)]/60 block">
              Annualized (ARR): {'\u20B9'}{(metrics?.totalARR ?? 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Active Workspaces */}
          <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-primary)]/60">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Total Workspaces</span>
              <div className="p-2 rounded bg-blue-500/10 text-blue-600">
                <Building2 size={16} />
              </div>
            </div>
            <div className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {metrics?.totalTenants ?? 0}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold block">
              {metrics?.activeTenants ?? 0} actively operational
            </span>
          </div>

          {/* Total Managed Employees */}
          <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-primary)]/60">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Total Managed Seats</span>
              <div className="p-2 rounded bg-amber-500/10 text-amber-600">
                <Users size={16} />
              </div>
            </div>
            <div className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {metrics?.totalEmployees ?? 0}
            </div>
            <span className="text-[11px] text-[var(--text-primary)]/60 block">
              Across all customer organizations
            </span>
          </div>

          {/* Lifetime Revenue */}
          <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-primary)]/60">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Collected Revenue</span>
              <div className="p-2 rounded bg-purple-500/10 text-purple-600">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {'\u20B9'}{(metrics?.totalCollectedRevenue ?? 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold block">
              {'\u20B9'}{(metrics?.thisMonthRevenue ?? 0).toLocaleString('en-IN')} this month
            </span>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'tenants'
                ? 'border-[var(--gold-500)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-primary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            <Building2 size={15} />
            <span>Tenants</span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'plans'
                ? 'border-[var(--gold-500)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-primary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers size={15} />
            <span>Plans</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'billing'
                ? 'border-[var(--gold-500)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-primary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            <Receipt size={15} />
            <span>Billing</span>
          </button>
        </div>

        {/* ── TAB: Tenants ─────────────────────────────── */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--border)]">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tenant by company name or code..."
                  className="register-input !pl-9 py-1.5 text-xs w-full"
                />
              </form>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUS_PILLS.map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(pill.value);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border cursor-pointer transition-colors ${
                      statusFilter === pill.value
                        ? 'border-[var(--gold-500)] bg-[var(--gold-500)]/10 text-[var(--text-primary)]'
                        : 'border-[var(--border)] text-[var(--text-primary)]/60 hover:border-[var(--text-primary)]/30'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tenants Table */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-primary)]/60">
                      <th className="py-3 px-4 w-12 text-center">Sr.</th>
                      <th className="py-3 px-4">Workspace / Organization</th>
                      <th className="py-3 px-4">Plan Tier</th>
                      <th className="py-3 px-4">Employee Seats</th>
                      <th className="py-3 px-4">Branches</th>
                      <th className="py-3 px-4">Valid Until</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {loadingTenants ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-primary)]/60">
                          <Loader2 size={16} className="animate-spin inline mr-2 text-[var(--gold-500)]" />
                          Loading workspaces...
                        </td>
                      </tr>
                    ) : tenants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-primary)]/60">
                          No tenant organizations found.
                        </td>
                      </tr>
                    ) : (
                      tenants.map((t, idx) => {
                        const isExpired = t.validUntil && new Date(t.validUntil) < new Date();
                        return (
                          <tr key={t.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                            <td className="py-3 px-4 font-mono text-center text-xs text-[var(--text-primary)]/60 w-12">
                              {(page - 1) * 15 + idx + 1}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs text-white shrink-0"
                                  style={{ backgroundColor: t.primaryColor || '#D97706' }}
                                >
                                  {t.logoUrl ? (
                                    <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover rounded" />
                                  ) : (
                                    t.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <strong className="text-[var(--text-primary)] block">{t.name}</strong>
                                  <span className="font-mono text-[10px] text-[var(--text-primary)]/60">
                                    {t.code || `ID: ${t.id}`}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] border border-[var(--gold-500)]/20">
                                {t.planName}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-data">
                              <strong>{t.employeeCount}</strong> / {t.maxEmployees} seats
                            </td>

                            <td className="py-3 px-4 font-data">
                              <strong>{t.branchCount}</strong> / {t.maxBranches} branches
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-mono text-[11px]">
                                {t.validUntil ? new Date(t.validUntil).toLocaleDateString() : 'Unlimited'}
                              </div>
                              {isExpired && (
                                <span className="text-[10px] text-rose-600 font-semibold block">Expired</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                                  t.isActive
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                }`}
                              >
                                {t.isActive ? 'Active' : 'Suspended'}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setExtendModalTenant(t);
                                    setExtendDays(14);
                                  }}
                                  className="px-2 py-1 text-[11px] font-semibold rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
                                  title="Extend Free Trial"
                                >
                                  + Trial
                                </button>

                                <button
                                  onClick={() => {
                                    setOverrideModalTenant(t);
                                    setOverridePlanId(plans.find((p) => p.name === t.planName)?.id || plans[0]?.id);
                                  }}
                                  className="px-2 py-1 text-[11px] font-semibold rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
                                  title="Override Plan"
                                >
                                  Plan
                                </button>

                                <button
                                  onClick={() => handleToggleTenantStatus(t)}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded border cursor-pointer ${
                                    t.isActive
                                      ? 'border-rose-500/30 text-rose-600 hover:bg-rose-500/10'
                                      : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
                                  }`}
                                >
                                  {t.isActive ? 'Suspend' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-sunken)]">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[var(--text-primary)]/60 font-mono">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Plans ───────────────────────────────── */}
        {activeTab === 'plans' && <PlansTab />}

        {/* ── TAB: Billing ─────────────────────────────── */}
        {activeTab === 'billing' && <BillingTab />}

        {/* ── EXTEND TRIAL MODAL ───────────────────────── */}
        {extendModalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
                <h4 className="font-display font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Calendar size={16} className="text-[var(--gold-500)]" />
                  Extend Trial: {extendModalTenant.name}
                </h4>
                <button onClick={() => setExtendModalTenant(null)} className="p-1 text-[var(--text-primary)]/60 cursor-pointer">
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <p className="text-[var(--text-primary)]/60">
                  Add trial days to <strong>{extendModalTenant.name}</strong> without charging a card.
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDays(d)}
                      className={`py-2 text-center rounded border font-semibold cursor-pointer transition-colors ${
                        extendDays === d
                          ? 'border-[var(--gold-500)] bg-[var(--gold-500)]/10 text-[var(--text-primary)] font-bold'
                          : 'border-[var(--border)] text-[var(--text-primary)]/60 hover:border-[var(--text-primary)]'
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>

                <div>
                  <label className="font-semibold text-[var(--text-primary)] block mb-1">Custom Days</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={extendDays}
                    onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
                    className="register-input w-full py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex justify-end gap-2">
                <button onClick={() => setExtendModalTenant(null)} className="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleExtendTrial}
                  disabled={extending}
                  className="btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {extending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Grant Extension</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── OVERRIDE PLAN MODAL ──────────────────────── */}
        {overrideModalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
                <h4 className="font-display font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Layers size={16} className="text-[var(--gold-500)]" />
                  Override Plan: {overrideModalTenant.name}
                </h4>
                <button onClick={() => setOverrideModalTenant(null)} className="p-1 text-[var(--text-primary)]/60 cursor-pointer">
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <p className="text-[var(--text-primary)]/60">
                  Manually assign a subscription tier to <strong>{overrideModalTenant.name}</strong>.
                </p>

                <div className="space-y-2">
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                        overridePlanId === p.id
                          ? 'border-[var(--gold-500)] bg-[var(--gold-500)]/10 font-bold'
                          : 'border-[var(--border)] hover:bg-[var(--surface-sunken)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="plan"
                          checked={overridePlanId === p.id}
                          onChange={() => setOverridePlanId(p.id)}
                          className="text-[var(--gold-500)]"
                        />
                        <span className="text-[var(--text-primary)]">{p.name}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-primary)]/60 font-mono">
                        {p.maxEmployees} seats
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex justify-end gap-2">
                <button onClick={() => setOverrideModalTenant(null)} className="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleOverridePlan}
                  disabled={overriding}
                  className="btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {overriding ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Assign Plan</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
