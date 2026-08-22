import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Calendar,
  ShieldCheck,
  Receipt,
  FileText,
  X,
  Lock,
} from 'lucide-react';

interface QuotaStatus {
  organizationId: number;
  organizationName: string;
  planName: string;
  planCode: string;
  status: string;
  maxEmployees: number;
  usedEmployees: number;
  availableEmployees: number;
  maxBranches: number;
  usedBranches: number;
  availableBranches: number;
  hasBiometricsModule: boolean;
  hasPayrollModule: boolean;
  hasRecruitmentModule: boolean;
  hasLoanManagement: boolean;
  hasCustomDomain: boolean;
  validUntil: string;
  trialEndsAt?: string;
  isExpired: boolean;
}

interface PlanItem {
  id: number;
  publicId: string;
  name: string;
  code: string;
  description: string;
  maxEmployees: number;
  maxBranches: number;
  hasBiometricsModule: boolean;
  hasPayrollModule: boolean;
  hasRecruitmentModule: boolean;
  hasLoanManagement: boolean;
  hasCustomDomain: boolean;
  pricePerMonth: number;
}

interface CheckoutOrder {
  orderId: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  keyId: string;
  planName: string;
  billingCycle: string;
}

interface PaymentHistoryItem {
  id: number;
  publicId: string;
  invoiceNumber: string;
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

export const SubscriptionTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [billingCycle, setBillingCycle] = useState<'Monthly' | 'Yearly'>('Monthly');

  // Checkout Modal State
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrder | null>(null);
  const [creatingOrderPlanId, setCreatingOrderPlanId] = useState<number | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Invoices & Billing History
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [quotaRes, plansRes] = await Promise.all([
        apiClient.get('/subscription/quota-status'),
        apiClient.get('/subscription/plans'),
      ]);
      setQuota(quotaRes.data);
      setPlans(plansRes.data);
      await fetchPaymentHistory();
    } catch (err: any) {
      console.error('Failed to load subscription info', err);
      showError('Error', 'Unable to load subscription and quota details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await apiClient.get('/payments/history', { params: { page: 1, pageSize: 10 } });
      setPaymentHistory(res.data.items || []);
    } catch (err) {
      console.error('Failed to load payment history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInitiateCheckout = async (plan: PlanItem) => {
    if (!isAdmin) {
      showError('Unauthorized', 'Only organization administrators can purchase or upgrade plans.');
      return;
    }

    try {
      setCreatingOrderPlanId(plan.id);
      const res = await apiClient.post('/payments/create-order', {
        planId: plan.id,
        billingCycle: billingCycle,
      });

      setCheckoutOrder(res.data);
    } catch (err: any) {
      showError('Checkout Failed', err.response?.data?.message || 'Could not initiate payment order.');
    } finally {
      setCreatingOrderPlanId(null);
    }
  };

  const handleProcessPayment = async () => {
    if (!checkoutOrder) return;

    try {
      setVerifyingPayment(true);

      // Simulation/Gateway execution
      const fakePaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await apiClient.post('/payments/verify', {
        orderId: checkoutOrder.orderId,
        paymentId: fakePaymentId,
        signature: 'sandbox_verified_signature',
      });

      showSuccess('Subscription Activated!', res.data.message || `Switched to ${checkoutOrder.planName}`);
      setCheckoutOrder(null);
      if (res.data.quota) {
        setQuota(res.data.quota);
      }
      await fetchPaymentHistory();
    } catch (err: any) {
      showError('Verification Failed', err.response?.data?.message || 'Payment verification could not be completed.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 size={24} className="animate-spin text-[var(--gold-500)]" />
      </div>
    );
  }

  const employeePercent = quota ? Math.min(100, Math.round((quota.usedEmployees / quota.maxEmployees) * 100)) : 0;
  const branchPercent = quota ? Math.min(100, Math.round((quota.usedBranches / quota.maxBranches) * 100)) : 0;

  return (
    <div className="space-y-8">
      {/* Current Subscription Banner */}
      <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--rule)] pb-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-[var(--navy-900)] text-[var(--gold-500)] shrink-0">
              <CreditCard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-[var(--ink)]">
                  {quota?.planName || 'Current Plan'}
                </h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full tracking-wider ${
                    quota?.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {quota?.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-muted)] font-ui mt-1">
                Workspace: <span className="font-semibold text-[var(--ink)]">{quota?.organizationName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-ui text-[var(--ink-muted)]">
            <div className="flex items-center gap-1.5 bg-[var(--paper)] px-3 py-1.5 rounded border border-[var(--rule)]">
              <Calendar size={14} className="text-[var(--gold-500)]" />
              <span>
                Renews on:{' '}
                <strong className="text-[var(--ink)]">
                  {quota?.validUntil ? new Date(quota.validUntil).toLocaleDateString() : 'N/A'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quotas & Resource Utilization Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
          {/* Employee Seat Usage */}
          <div className="bg-[var(--paper)] p-4 rounded-[4px] border border-[var(--rule)] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-ui">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <Users size={14} className="text-[var(--gold-500)]" /> Employee Seats Utilization
              </span>
              <span className="font-data font-bold text-[var(--ink)]">
                {quota?.usedEmployees} / {quota?.maxEmployees} seats ({employeePercent}%)
              </span>
            </div>
            <div className="w-full bg-[var(--canvas)] h-2 rounded-full overflow-hidden border border-[var(--rule)]">
              <div
                className={`h-full transition-all duration-500 ${
                  employeePercent >= 90 ? 'bg-rose-500' : employeePercent >= 75 ? 'bg-amber-500' : 'bg-[var(--gold-500)]'
                }`}
                style={{ width: `${employeePercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              {quota?.availableEmployees ?? 0} seats remaining before plan quota limit is reached.
            </p>
          </div>

          {/* Branch Utilization */}
          <div className="bg-[var(--paper)] p-4 rounded-[4px] border border-[var(--rule)] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-ui">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <Building2 size={14} className="text-[var(--gold-500)]" /> Branch Location Quota
              </span>
              <span className="font-data font-bold text-[var(--ink)]">
                {quota?.usedBranches} / {quota?.maxBranches} branches ({branchPercent}%)
              </span>
            </div>
            <div className="w-full bg-[var(--canvas)] h-2 rounded-full overflow-hidden border border-[var(--rule)]">
              <div
                className="h-full bg-[var(--navy-900)] transition-all duration-500"
                style={{ width: `${branchPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              {quota?.availableBranches ?? 0} branch slots available under current plan.
            </p>
          </div>
        </div>

        {/* Feature Entitlements Badges */}
        <div className="mt-5 pt-4 border-t border-[var(--rule)]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] font-ui block mb-3">
            Enabled SaaS Modules
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Biometrics & Attendance Sync', enabled: quota?.hasBiometricsModule },
              { label: 'Automated Payroll Engine', enabled: quota?.hasPayrollModule },
              { label: 'Recruitment & Candidates', enabled: quota?.hasRecruitmentModule },
              { label: 'Employee Loan Management', enabled: quota?.hasLoanManagement },
              { label: 'Custom Domain & SSO', enabled: quota?.hasCustomDomain },
            ].map((module, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-ui border ${
                  module.enabled
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    : 'bg-zinc-500/5 text-[var(--ink-muted)] border-[var(--rule)] opacity-60'
                }`}
              >
                {module.enabled ? (
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={13} className="shrink-0" />
                )}
                <span>{module.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Selection Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--ink)]">Available Subscription Tiers</h3>
            <p className="text-xs text-[var(--ink-muted)] font-ui">
              Scale your organization by upgrading seats and unlocking premium HRMS modules.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center bg-[var(--surface-sunken)] p-1 rounded border border-[var(--rule)] self-start">
            <button
              onClick={() => setBillingCycle('Monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                billingCycle === 'Monthly' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-muted)]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('Yearly')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                billingCycle === 'Yearly' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-muted)]'
              }`}
            >
              Yearly <span className="text-[10px] text-emerald-600 font-bold">(-15%)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = quota?.planCode === plan.code;
            const isCreating = creatingOrderPlanId === plan.id;
            const price =
              billingCycle === 'Yearly'
                ? Math.round(plan.pricePerMonth * 0.85)
                : plan.pricePerMonth;

            return (
              <div
                key={plan.id}
                className={`rounded-[4px] border p-5 flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-[var(--gold-500)] bg-[var(--gold-500)]/5 shadow-sm ring-1 ring-[var(--gold-500)]/30'
                    : 'border-[var(--rule)] bg-[var(--surface)] hover:border-[var(--gold-500)]/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-base font-bold text-[var(--ink)]">{plan.name}</h4>
                    {isCurrent && (
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-[var(--gold-500)] text-[var(--navy-900)]">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] font-ui mt-1 min-h-[36px]">{plan.description}</p>

                  <div className="mt-4 mb-4 pb-4 border-b border-[var(--rule)]">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-2xl font-bold text-[var(--ink)]">
                        {'\u20B9'}{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-[var(--ink-muted)] font-ui">/ month</span>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs font-ui text-[var(--ink)]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span>
                        Up to <strong>{plan.maxEmployees}</strong> Employee Seats
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span>
                        Up to <strong>{plan.maxBranches}</strong> Branch Location(s)
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasBiometricsModule ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--ink-muted)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasBiometricsModule ? 'text-[var(--ink-muted)]' : ''}>
                        Biometrics & Sync
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasPayrollModule ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--ink-muted)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasPayrollModule ? 'text-[var(--ink-muted)]' : ''}>Payroll Engine</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasRecruitmentModule ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--ink-muted)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasRecruitmentModule ? 'text-[var(--ink-muted)]' : ''}>
                        Recruitment Pipeline
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasLoanManagement ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--ink-muted)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasLoanManagement ? 'text-[var(--ink-muted)]' : ''}>
                        Loans & Advances
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 px-3 text-xs font-semibold rounded bg-[var(--paper)] text-[var(--ink-muted)] border border-[var(--rule)] cursor-default"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInitiateCheckout(plan)}
                      disabled={isCreating}
                      className="w-full py-2 px-3 text-xs font-semibold rounded bg-[var(--navy-900)] text-[var(--gold-500)] hover:bg-[var(--navy-800)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isCreating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <span>Select Plan</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices & Billing History Section */}
      <div className="space-y-4 pt-4 border-t border-[var(--rule)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <Receipt size={18} className="text-[var(--gold-500)]" />
              Invoices & Payment History
            </h3>
            <p className="text-xs text-[var(--ink-muted)] font-ui">
              View and verify past subscription billing transactions.
            </p>
          </div>
        </div>

        <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-sunken)] border-b border-[var(--rule)] font-ui text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Plan Tier</th>
                <th className="py-3 px-4">Billing Period</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Subtotal</th>
                <th className="py-3 px-4">Tax (18% GST)</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {loadingHistory ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--ink-muted)]">
                    <Loader2 size={16} className="animate-spin inline mr-2 text-[var(--gold-500)]" />
                    Loading billing history...
                  </td>
                </tr>
              ) : paymentHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--ink-muted)] font-ui">
                    <FileText size={20} className="mx-auto mb-1 opacity-40" />
                    No previous payment records found.
                  </td>
                </tr>
              ) : (
                paymentHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[var(--ink)]">{item.invoiceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-[var(--ink)]">{item.planName}</td>
                    <td className="py-3 px-4 text-[var(--ink-muted)]">{item.billingCycle}</td>
                    <td className="py-3 px-4 text-[var(--ink-muted)] font-mono text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-data">
                      {'\u20B9'}{item.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-data text-[var(--ink-muted)]">
                      {'\u20B9'}{item.taxAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-data font-bold text-[var(--ink)]">
                      {'\u20B9'}{item.total.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                          item.status === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Online Checkout Order Modal */}
      {checkoutOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-[var(--gold-500)]" />
                <h4 className="font-display font-bold text-base text-[var(--ink)]">Secure Order Checkout</h4>
              </div>
              <button
                onClick={() => setCheckoutOrder(null)}
                className="p-1.5 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Summary */}
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-[var(--paper)] p-4 rounded border border-[var(--rule)] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ink-muted)] font-ui">Plan Tier:</span>
                  <strong className="text-[var(--ink)] font-display text-sm">{checkoutOrder.planName}</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ink-muted)] font-ui">Billing Frequency:</span>
                  <span className="font-semibold text-[var(--ink)]">{checkoutOrder.billingCycle}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ink-muted)] font-ui">Invoice Number:</span>
                  <span className="font-mono text-[11px] text-[var(--ink)]">{checkoutOrder.invoiceNumber}</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--ink-muted)]">Subtotal</span>
                  <span className="font-data font-semibold text-[var(--ink)]">
                    {'\u20B9'}{checkoutOrder.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--ink-muted)]">Goods & Services Tax (18% GST)</span>
                  <span className="font-data text-[var(--ink-muted)]">
                    {'\u20B9'}{checkoutOrder.taxAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-[var(--rule)] pt-2 text-sm">
                  <span className="font-bold text-[var(--ink)]">Total Payable</span>
                  <span className="font-display font-bold text-base text-[var(--gold-600)] dark:text-[var(--gold-400)]">
                    {'\u20B9'}{checkoutOrder.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
                <span>Instant subscription activation upon checkout confirmation.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[var(--rule)] bg-[var(--surface-sunken)] flex items-center justify-end gap-3">
              <button
                onClick={() => setCheckoutOrder(null)}
                disabled={verifyingPayment}
                className="btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={verifyingPayment}
                className="btn-primary text-xs py-2 px-4 font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {verifyingPayment ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Verifying Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Pay with UPI / Card / NetBanking</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
