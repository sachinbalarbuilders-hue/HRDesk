import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/CompanyContext';
import { formatDate } from '../../utils/formatters';
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
  const { isAdmin, user, hasPermission } = useAuth();
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

  const { currentOrganization } = useOrganization();

  useEffect(() => {
    fetchData();
  }, [currentOrganization?.id]);

  const handleInitiateCheckout = async (plan: PlanItem) => {
    const canManageBilling = Boolean(
      isAdmin ||
      user?.isPlatformUser ||
      user?.role === 'Admin' ||
      user?.role === 'SuperAdmin' ||
      user?.roleName?.toLowerCase().includes('admin') ||
      hasPermission('Masters.Organizations')
    );

    if (!canManageBilling) {
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

    // Load Razorpay Checkout JS dynamically
    const loadRazorpay = (): Promise<any> => {
      return new Promise((resolve) => {
        if ((window as any).Razorpay) { resolve((window as any).Razorpay); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve((window as any).Razorpay);
        document.body.appendChild(script);
      });
    };

    const Razorpay = await loadRazorpay();
    if (!Razorpay) { showError('Error', 'Failed to load payment gateway.'); return; }

    const options = {
      key: checkoutOrder.keyId,
      amount: Math.round(checkoutOrder.totalAmount * 100), // paise
      currency: checkoutOrder.currency,
      name: 'HRDesk',
      description: `${checkoutOrder.planName} - ${checkoutOrder.billingCycle}`,
      order_id: checkoutOrder.orderId,
      handler: async (response: any) => {
        // Payment successful — verify on backend
        try {
          setVerifyingPayment(true);
          const res = await apiClient.post('/payments/verify', {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
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
      },
      prefill: {},
      theme: { color: '#0D9488' },
      modal: {
        ondismiss: async () => {
          // User closed popup without paying — mark as cancelled
          try { await apiClient.post('/payments/cancel', { orderId: checkoutOrder.orderId, reason: 'User dismissed checkout' }); } catch {}
          setCheckoutOrder(null);
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', async (response: any) => {
      showError('Payment Failed', response.error?.description || 'Payment was not successful. Please try again.');
      // Mark order as failed in backend
      try { await apiClient.post('/payments/cancel', { orderId: checkoutOrder.orderId, reason: response.error?.description || 'Payment failed' }); } catch {}
      setCheckoutOrder(null);
    });
    rzp.open();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
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
            <div className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[var(--accent)] border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
              <CreditCard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className=" text-base font-semibold text-[var(--text-primary)]">
                  {quota?.planName || 'Current Plan'}
                </h2>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold uppercase rounded-full tracking-wider ${
                    quota?.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {quota?.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]  mt-1">
                Workspace: <span className="font-semibold text-[var(--text-primary)]">{quota?.organizationName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs  text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5 bg-[var(--paper)] px-3 py-1.5 rounded border border-[var(--rule)]">
              <Calendar size={14} className="text-[var(--accent)]" />
              <span>
                Renews on:{' '}
                <strong className="text-[var(--text-primary)]">
                  {quota?.validUntil ? formatDate(quota.validUntil) : 'N/A'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quotas & Resource Utilization Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
          {/* Employee Seat Usage */}
          <div className="bg-[var(--paper)] p-4 rounded-[4px] border border-[var(--rule)] space-y-2.5">
            <div className="flex items-center justify-between text-xs ">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Users size={14} className="text-[var(--accent)]" /> Employee Seats Utilization
              </span>
              <span className=" font-semibold text-[var(--text-primary)]">
                {quota?.usedEmployees} / {quota?.maxEmployees} seats ({employeePercent}%)
              </span>
            </div>
            <div className="w-full bg-[var(--canvas)] h-2 rounded-full overflow-hidden border border-[var(--rule)]">
              <div
                className={`h-full transition-all duration-500 ${
                  employeePercent >= 90 ? 'bg-rose-500' : employeePercent >= 75 ? 'bg-amber-500' : 'bg-[var(--accent)]'
                }`}
                style={{ width: `${employeePercent}%` }}
              />
            </div>
            <p className="text-xs font-normal text-[var(--text-secondary)]">
              {quota?.availableEmployees ?? 0} seats remaining before plan quota limit is reached.
            </p>
          </div>

          {/* Branch Utilization */}
          <div className="bg-[var(--paper)] p-4 rounded-[4px] border border-[var(--rule)] space-y-2.5">
            <div className="flex items-center justify-between text-xs ">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Building2 size={14} className="text-[var(--accent)]" /> Branch Location Quota
              </span>
              <span className=" font-semibold text-[var(--text-primary)]">
                {quota?.usedBranches} / {quota?.maxBranches} branches ({branchPercent}%)
              </span>
            </div>
            <div className="w-full bg-[var(--canvas)] h-2 rounded-full overflow-hidden border border-[var(--rule)]">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${branchPercent}%` }}
              />
            </div>
            <p className="text-xs font-normal text-[var(--text-secondary)]">
              {quota?.availableBranches ?? 0} branch slots available under current plan.
            </p>
          </div>
        </div>

        {/* Feature Entitlements Badges */}
        <div className="mt-5 pt-4 border-t border-[var(--rule)]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]  block mb-3">
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
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs  border ${
                  module.enabled
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    : 'bg-zinc-500/5 text-[var(--text-secondary)] border-[var(--rule)] opacity-60'
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
            <h3 className=" text-base font-semibold text-[var(--text-primary)]">Available Subscription Tiers</h3>
            <p className="text-xs text-[var(--text-secondary)] ">
              Scale your organization by upgrading seats and unlocking premium HRMS modules.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center bg-[var(--surface-sunken)] p-1 rounded border border-[var(--rule)] self-start">
            <button
              onClick={() => setBillingCycle('Monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                billingCycle === 'Monthly' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('Yearly')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                billingCycle === 'Yearly' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
              }`}
            >
              Yearly <span className="text-xs font-normal text-emerald-600 font-semibold">(-15%)</span>
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
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm ring-1 ring-[var(--accent)]/30'
                    : 'border-[var(--rule)] bg-[var(--surface)] hover:border-[var(--accent)]/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className=" text-base font-semibold text-[var(--text-primary)]">{plan.name}</h4>
                    {isCurrent && (
                      <span className="px-2 py-0.5 text-xs font-normal font-semibold uppercase rounded bg-[var(--accent)] text-white shadow-xs">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]  mt-1 min-h-[36px]">{plan.description}</p>

                  <div className="mt-4 mb-4 pb-4 border-b border-[var(--rule)]">
                    <div className="flex items-baseline gap-1">
                      <span className=" text-base font-semibold text-[var(--text-primary)]">
                        {'\u20B9'}{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] ">/ month</span>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs  text-[var(--text-primary)]">
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
                        <XCircle size={13} className="text-[var(--text-secondary)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasBiometricsModule ? 'text-[var(--text-secondary)]' : ''}>
                        Biometrics & Sync
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasPayrollModule ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--text-secondary)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasPayrollModule ? 'text-[var(--text-secondary)]' : ''}>Payroll Engine</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasRecruitmentModule ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--text-secondary)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasRecruitmentModule ? 'text-[var(--text-secondary)]' : ''}>
                        Recruitment Pipeline
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {plan.hasLoanManagement ? (
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-[var(--text-secondary)] opacity-50 shrink-0" />
                      )}
                      <span className={!plan.hasLoanManagement ? 'text-[var(--text-secondary)]' : ''}>
                        Loans & Advances
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 px-3 text-xs font-semibold rounded bg-[var(--paper)] text-[var(--text-secondary)] border border-[var(--rule)] cursor-default"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInitiateCheckout(plan)}
                      disabled={isCreating}
                      className="w-full py-2 px-3 text-xs font-semibold rounded btn-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
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
            <h3 className=" text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Receipt size={18} className="text-[var(--accent)]" />
              Invoices & Payment History
            </h3>
            <p className="text-xs text-[var(--text-secondary)] ">
              View and verify past subscription billing transactions.
            </p>
          </div>
        </div>

        <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-sunken)] border-b border-[var(--rule)]  text-xs font-normal uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="py-3 px-4 w-12 text-center">Sr.</th>
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
                  <td colSpan={9} className="py-8 text-center text-[var(--text-secondary)]">
                    <Loader2 size={16} className="animate-spin inline mr-2 text-[var(--accent)]" />
                    Loading billing history...
                  </td>
                </tr>
              ) : paymentHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--text-secondary)] ">
                    <FileText size={20} className="mx-auto mb-1 opacity-40" />
                    No previous payment records found.
                  </td>
                </tr>
              ) : (
                paymentHistory.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                    <td className="py-3 px-4  text-center text-xs text-[var(--text-secondary)] w-12">{idx + 1}</td>
                    <td className="py-3 px-4  font-semibold text-[var(--text-primary)]">{item.invoiceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{item.planName}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{item.billingCycle}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]  text-xs font-normal">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-3 px-4 ">
                      {'\u20B9'}{item.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4  text-[var(--text-secondary)]">
                      {'\u20B9'}{item.taxAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4  font-semibold text-[var(--text-primary)]">
                      {'\u20B9'}{item.total.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-xs font-normal font-semibold uppercase rounded-full ${
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
                <Lock size={16} className="text-[var(--accent)]" />
                <h4 className=" font-semibold text-base text-[var(--text-primary)]">Secure Order Checkout</h4>
              </div>
              <button
                onClick={() => setCheckoutOrder(null)}
                className="p-1.5 rounded hover:bg-[var(--paper)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Summary */}
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-[var(--paper)] p-4 rounded border border-[var(--rule)] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-secondary)] ">Plan Tier:</span>
                  <strong className="text-[var(--text-primary)]  text-sm">{checkoutOrder.planName}</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-secondary)] ">Billing Frequency:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{checkoutOrder.billingCycle}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-secondary)] ">Invoice Number:</span>
                  <span className=" text-xs font-normal text-[var(--text-primary)]">{checkoutOrder.invoiceNumber}</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Subtotal</span>
                  <span className=" font-semibold text-[var(--text-primary)]">
                    {'\u20B9'}{checkoutOrder.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Goods & Services Tax (18% GST)</span>
                  <span className=" text-[var(--text-secondary)]">
                    {'\u20B9'}{checkoutOrder.taxAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-[var(--rule)] pt-2 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">Total Payable</span>
                  <span className=" font-semibold text-base text-[var(--accent-hover)] dark:text-[var(--gold-400)]">
                    {'\u20B9'}{checkoutOrder.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs font-normal text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
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
