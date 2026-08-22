import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
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

interface GlobalPaymentItem {
  id: number;
  publicId: string;
  invoiceNumber: string;
  organizationName: string;
  planName: string;
  amount: number;
  taxAmount: number;
  total: number;
  currency: string;
  billingCycle: string;
  paymentGateway: string;
  status: string;
  paidAt?: string;
  createdAt: string;
}

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'tenants' | 'billing'>('tenants');

  // Loading States
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Data States
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [payments, setPayments] = useState<GlobalPaymentItem[]>([]);

  // Pagination & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Modals
  const [extendModalTenant, setExtendModalTenant] = useState<TenantItem | null>(null);
  const [extendDays, setExtendDays] = useState(14);
  const [extending, setExtending] = useState(false);

  const [overrideModalTenant, setOverrideModalTenant] = useState<TenantItem | null>(null);
  const [overridePlanId, setOverridePlanId] = useState<number | null>(null);
  const [overriding, setOverriding] = useState(false);

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

  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await apiClient.get('/superadmin/payments', {
        params: { page: 1, pageSize: 20 },
      });
      setPayments(res.data.items || []);
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchPlans();
  }, []);

  useEffect(() => {
    if (activeTab === 'tenants') {
      fetchTenants();
    } else {
      fetchPayments();
    }
  }, [activeTab, page, statusFilter]);

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

  if (user && user.role !== 'SuperAdmin' && user.role !== 'Super Admin') {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-6 text-center font-ui">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
          <Lock size={32} />
        </div>
        <h2 className="font-display text-2xl font-bold text-[var(--ink)] mb-2">Restricted Access</h2>
        <p className="text-sm text-[var(--ink-muted)] max-w-md mb-6">
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

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col text-[var(--ink)]">
      {/* Top Global SuperAdmin Master Navbar */}
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
            <span className="text-[10px] text-zinc-400 font-mono">Global Multi-Tenant Infrastructure & Overrides</span>
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
              else fetchPayments();
            }}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Refresh Platform Metrics"
          >
            <RefreshCw size={14} className={loadingMetrics ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 font-ui">

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="bg-[var(--surface)] p-5 rounded-[4px] border border-[var(--rule)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Monthly Recurring (MRR)</span>
            <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-[var(--ink)]">
            {'\u20B9'}{(metrics?.totalMRR ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-[var(--ink-muted)] block">
            Annualized (ARR): {'\u20B9'}{(metrics?.totalARR ?? 0).toLocaleString('en-IN')}
          </span>
        </div>

        {/* Active Workspaces */}
        <div className="bg-[var(--surface)] p-5 rounded-[4px] border border-[var(--rule)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Workspaces</span>
            <div className="p-2 rounded bg-blue-500/10 text-blue-600">
              <Building2 size={16} />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-[var(--ink)]">
            {metrics?.totalTenants ?? 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">
            {metrics?.activeTenants ?? 0} actively operational
          </span>
        </div>

        {/* Total Managed Employees */}
        <div className="bg-[var(--surface)] p-5 rounded-[4px] border border-[var(--rule)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Managed Seats</span>
            <div className="p-2 rounded bg-amber-500/10 text-amber-600">
              <Users size={16} />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-[var(--ink)]">
            {metrics?.totalEmployees ?? 0}
          </div>
          <span className="text-[11px] text-[var(--ink-muted)] block">
            Across all customer organizations
          </span>
        </div>

        {/* Lifetime Revenue */}
        <div className="bg-[var(--surface)] p-5 rounded-[4px] border border-[var(--rule)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Collected Revenue</span>
            <div className="p-2 rounded bg-purple-500/10 text-purple-600">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-[var(--ink)]">
            {'\u20B9'}{(metrics?.totalCollectedRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block">
            {'\u20B9'}{(metrics?.thisMonthRevenue ?? 0).toLocaleString('en-IN')} this month
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--rule)]">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'tenants'
              ? 'border-[var(--gold-500)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Building2 size={15} />
          <span>Tenant Workspaces Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'billing'
              ? 'border-[var(--gold-500)] text-[var(--ink)]'
              : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Receipt size={15} />
          <span>Global Billing & Invoices</span>
        </button>
      </div>

      {/* TAB 1: Tenants Directory */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)] p-3 rounded-[4px] border border-[var(--rule)]"
          >
            <div className="relative flex-1 w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenant by company name or code..."
                className="register-input !pl-9 py-1.5 text-xs w-full"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="register-input py-1.5 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Suspended Only</option>
              </select>

              <button type="submit" className="btn-primary py-1.5 px-4 text-xs font-semibold cursor-pointer">
                Filter
              </button>
            </div>
          </form>

          {/* Tenants Table */}
          <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-sunken)] border-b border-[var(--rule)] text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                    <th className="py-3 px-4">Workspace / Organization</th>
                    <th className="py-3 px-4">Plan Tier</th>
                    <th className="py-3 px-4">Employee Seats</th>
                    <th className="py-3 px-4">Branches</th>
                    <th className="py-3 px-4">Valid Until</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {loadingTenants ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[var(--ink-muted)]">
                        <Loader2 size={16} className="animate-spin inline mr-2 text-[var(--gold-500)]" />
                        Loading workspaces...
                      </td>
                    </tr>
                  ) : tenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[var(--ink-muted)]">
                        No tenant organizations found.
                      </td>
                    </tr>
                  ) : (
                    tenants.map((t) => {
                      const isExpired = t.validUntil && new Date(t.validUntil) < new Date();
                      return (
                        <tr key={t.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
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
                                <strong className="text-[var(--ink)] block">{t.name}</strong>
                                <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                                  {t.code || `ID: ${t.id}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/20">
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
                                className="px-2 py-1 text-[11px] font-semibold rounded border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--paper)] cursor-pointer"
                                title="Extend Free Trial"
                              >
                                + Trial
                              </button>

                              <button
                                onClick={() => {
                                  setOverrideModalTenant(t);
                                  setOverridePlanId(plans.find((p) => p.name === t.planName)?.id || plans[0]?.id);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold rounded border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--paper)] cursor-pointer"
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
          </div>
        </div>
      )}

      {/* TAB 2: Global Invoices & Financials */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-sunken)] border-b border-[var(--rule)] text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Workspace / Organization</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Base Amount</th>
                  <th className="py-3 px-4">GST (18%)</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {loadingPayments ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[var(--ink-muted)]">
                      <Loader2 size={16} className="animate-spin inline mr-2 text-[var(--gold-500)]" />
                      Loading global payment transactions...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[var(--ink-muted)]">
                      No platform payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[var(--ink)]">{p.invoiceNumber}</td>
                      <td className="py-3 px-4 font-semibold text-[var(--ink)]">{p.organizationName}</td>
                      <td className="py-3 px-4">{p.planName}</td>
                      <td className="py-3 px-4 text-[var(--ink-muted)]">{p.billingCycle}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--ink-muted)]">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-data">
                        {'\u20B9'}{p.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-data text-[var(--ink-muted)]">
                        {'\u20B9'}{p.taxAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-data font-bold text-[var(--ink)]">
                        {'\u20B9'}{p.total.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                            p.status === 'Paid'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXTEND TRIAL MODAL */}
      {extendModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <h4 className="font-display font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                <Calendar size={16} className="text-[var(--gold-500)]" />
                Extend Trial: {extendModalTenant.name}
              </h4>
              <button onClick={() => setExtendModalTenant(null)} className="p-1 text-[var(--ink-muted)] cursor-pointer">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[var(--ink-muted)]">
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
                        ? 'border-[var(--gold-500)] bg-[var(--gold-500)]/10 text-[var(--ink)] font-bold'
                        : 'border-[var(--rule)] text-[var(--ink-muted)] hover:border-[var(--ink)]'
                    }`}
                  >
                    +{d} Days
                  </button>
                ))}
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Custom Days</label>
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

            <div className="p-3 border-t border-[var(--rule)] bg-[var(--surface-sunken)] flex justify-end gap-2">
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

      {/* OVERRIDE PLAN MODAL */}
      {overrideModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <h4 className="font-display font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                <Layers size={16} className="text-[var(--gold-500)]" />
                Override Plan: {overrideModalTenant.name}
              </h4>
              <button onClick={() => setOverrideModalTenant(null)} className="p-1 text-[var(--ink-muted)] cursor-pointer">
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[var(--ink-muted)]">
                Manually assign a subscription tier to <strong>{overrideModalTenant.name}</strong>.
              </p>

              <div className="space-y-2">
                {plans.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                      overridePlanId === p.id
                        ? 'border-[var(--gold-500)] bg-[var(--gold-500)]/10 font-bold'
                        : 'border-[var(--rule)] hover:bg-[var(--paper)]'
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
                      <span className="text-[var(--ink)]">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-[var(--ink-muted)] font-mono">
                      {p.maxEmployees} seats
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--rule)] bg-[var(--surface-sunken)] flex justify-end gap-2">
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
