import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
  MapPin,
  Users,
  Sparkles,
  Crown,
  Check,
} from 'lucide-react';

export const RegisterTenant: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan');

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Plan selection state
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>(selectedPlan || 'growth');
  const [plansLoading, setPlansLoading] = useState(true);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugMessage, setSlugMessage] = useState('');

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [city, setCity] = useState('');
  const [headcount, setHeadcount] = useState('11-50');

  // Fetch plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setPlansLoading(true);
        const res = await apiClient.get('/subscription/plans');
        setPlans(res.data);
      } catch {
        // Fallback plans if API is unavailable
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Auto-select plan from URL param
  useEffect(() => {
    if (selectedPlan && plans.length > 0) {
      const match = plans.find(
        (p: any) => p.code?.toLowerCase() === selectedPlan.toLowerCase() || p.name?.toLowerCase() === selectedPlan.toLowerCase()
      );
      if (match) {
        setSelectedPlanCode(match.code || match.name);
      }
    }
  }, [selectedPlan, plans]);

  // Slug auto-generator from company name
  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    if (step === 2 && (!workspaceSlug || workspaceSlug === slugify(companyName))) {
      const generated = slugify(val);
      setWorkspaceSlug(generated);
      if (generated.length >= 3) {
        checkSlugAvailability(generated);
      }
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const checkSlugAvailability = async (slugToTest: string) => {
    if (!slugToTest || slugToTest.length < 3) {
      setSlugAvailable(null);
      setSlugMessage('');
      return;
    }

    try {
      setSlugChecking(true);
      const res = await apiClient.get(`/auth/check-slug?slug=${encodeURIComponent(slugToTest)}`);
      setSlugAvailable(res.data.available);
      setSlugMessage(res.data.message);
    } catch {
      setSlugAvailable(false);
      setSlugMessage('Unable to verify workspace URL.');
    } finally {
      setSlugChecking(false);
    }
  };

  const handleSlugBlur = () => {
    checkSlugAvailability(workspaceSlug);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!selectedPlanCode) {
        showError('Validation Error', 'Please select a plan to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!companyName.trim()) {
        showError('Validation Error', 'Company name is required.');
        return;
      }
      if (!workspaceSlug.trim() || workspaceSlug.length < 3) {
        showError('Validation Error', 'Workspace URL must be at least 3 characters.');
        return;
      }
      if (slugAvailable === false) {
        showError('Validation Error', 'This workspace URL is already taken. Please choose another.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!adminName.trim() || !adminEmail.trim() || !adminPassword) {
        showError('Validation Error', 'All admin credentials are required.');
        return;
      }
      if (adminPassword.length < 6) {
        showError('Validation Error', 'Password must be at least 6 characters.');
        return;
      }
      if (adminPassword !== confirmPassword) {
        showError('Validation Error', 'Passwords do not match.');
        return;
      }
      setStep(4);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      const payload = {
        companyName: companyName.trim(),
        workspaceSlug: workspaceSlug.trim().toLowerCase(),
        adminFullName: adminName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPhone: adminPhone.trim() || undefined,
        password: adminPassword,
        headOfficeCity: city.trim() || undefined,
        employeeCountRange: headcount,
        planCode: selectedPlanCode,
      };

      const res = await apiClient.post('/auth/register-tenant', payload);

      showSuccess('Workspace Provisioned!', 'Your organization and 14-day free trial are ready.');

      if (res.data.token) {
        localStorage.setItem('auth_token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        localStorage.setItem('tenant', JSON.stringify(res.data.tenant));
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      showError('Provisioning Error', err.response?.data?.message || 'Failed to create organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const getPlanFeatures = (plan: any) => {
    const features: string[] = [];
    if (plan.maxEmployees) features.push(`Up to ${plan.maxEmployees} employees`);
    if (plan.maxBranches) features.push(`${plan.maxBranches} branch${plan.maxBranches > 1 ? 'es' : ''}`);
    if (plan.biometrics) features.push('Biometric attendance');
    if (plan.payroll) features.push('Payroll management');
    if (plan.recruitment) features.push('Recruitment module');
    if (plan.loans) features.push('Loan management');
    if (plan.customDomain) features.push('Custom domain');
    return features;
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2">
          <div className="h-10 w-10 bg-[var(--navy-900)] rounded flex items-center justify-center text-[var(--gold-500)] shadow-md">
            <Building2 size={24} />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-[var(--ink)]">
            HRDesk<span className="text-[var(--gold-500)] text-sm ml-1 font-mono">CLOUD</span>
          </span>
        </div>
        <h2 className="mt-4 text-center text-xl font-display font-bold text-[var(--ink)]">
          Create your Organization Workspace
        </h2>
        <p className="mt-1 text-center text-xs text-[var(--ink-muted)] font-ui">
          Start your <strong className="text-[var(--gold-600)] dark:text-[var(--gold-400)]">14-day full free trial</strong>. No credit card required.
        </p>

        {/* Step Indicator */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                  step === s
                    ? 'bg-[var(--gold-500)] text-[var(--navy-900)] ring-2 ring-[var(--gold-500)]/30'
                    : step > s
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 4 && <div className={`w-8 h-[2px] ${step > s ? 'bg-emerald-500' : 'bg-[var(--rule)]'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-6 sm:mx-auto sm:w-full ${step === 1 ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
        <div className="bg-[var(--surface)] py-8 px-6 shadow-xl rounded-[var(--radius-lg)] border border-[var(--rule)] sm:px-10">
          {/* STEP 1: Plan Selection */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div className="text-center mb-2">
                <h3 className="text-sm font-display font-bold text-[var(--ink)]">Choose your plan</h3>
                <p className="text-[11px] text-[var(--ink-muted)] font-ui mt-0.5">
                  All plans include a 14-day free trial. Upgrade or downgrade anytime.
                </p>
              </div>

              {plansLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-[var(--ink-muted)]" />
                  <span className="ml-2 text-xs text-[var(--ink-muted)]">Loading plans...</span>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--ink-muted)]">
                  <p>Unable to load plans. You can continue with the default plan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {plans.map((plan: any) => {
                    const isSelected = selectedPlanCode === (plan.code || plan.name);
                    const isFree = plan.price === 0 || plan.pricePerMonth === 0;
                    const price = plan.pricePerMonth ?? plan.price ?? 0;
                    const features = getPlanFeatures(plan);

                    return (
                      <button
                        key={plan.code || plan.name}
                        type="button"
                        onClick={() => setSelectedPlanCode(plan.code || plan.name)}
                        className={`relative text-left p-4 rounded-[var(--radius-lg)] border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[var(--gold-500)] ring-2 ring-[var(--gold-500)]/30 bg-[var(--gold-500)]/5'
                            : 'border-[var(--rule)] bg-[var(--surface)] hover:border-[var(--gold-500)]/50'
                        }`}
                      >
                        {/* Selected checkmark */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--gold-500)] rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}

                        {/* Free badge */}
                        {isFree && (
                          <span className="inline-block mb-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Free Forever
                          </span>
                        )}

                        {!isFree && (
                          <span className="inline-block mb-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/20">
                            <Sparkles size={9} className="inline mr-0.5 -mt-px" />
                            14-day trial
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 mb-1">
                          {plan.code === 'enterprise' || plan.name?.toLowerCase().includes('enterprise') ? (
                            <Crown size={14} className="text-[var(--gold-500)]" />
                          ) : null}
                          <span className="text-xs font-bold text-[var(--ink)] font-display">
                            {plan.name}
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-lg font-bold text-[var(--ink)] font-display">
                            {formatPrice(price)}
                          </span>
                          {!isFree && (
                            <span className="text-[10px] text-[var(--ink-muted)] font-ui">/month</span>
                          )}
                        </div>

                        <ul className="space-y-1">
                          {features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-[var(--ink-muted)]">
                              <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!selectedPlanCode && plans.length > 0}
                  className="btn-primary w-full py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>Continue to Company Details</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Organization Details */}
          {step === 2 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              {selectedPlanCode && (
                <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold-500)]/10 border border-[var(--gold-500)]/20 text-[var(--gold-600)] dark:text-[var(--gold-400)] text-[11px] font-bold">
                  <Sparkles size={12} />
                  <span>Plan: {selectedPlanCode.replace(/_/g, ' ')}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Company / Organization Name *
                </label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="register-input !pl-9 text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Workspace URL *
                </label>
                <div className="flex rounded-[var(--radius-md)] shadow-2xs">
                  <input
                    type="text"
                    required
                    value={workspaceSlug}
                    onChange={(e) => {
                      const clean = slugify(e.target.value);
                      setWorkspaceSlug(clean);
                    }}
                    onBlur={handleSlugBlur}
                    placeholder="acme"
                    className="register-input text-xs flex-1 rounded-r-none font-mono"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-[var(--radius-md)] border border-l-0 border-[var(--rule)] bg-[var(--surface-sunken)] text-xs text-[var(--ink-muted)] font-mono">
                    .hrdesk.app
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] font-ui">
                  {slugChecking ? (
                    <span className="text-[var(--ink-muted)] flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Checking availability...
                    </span>
                  ) : slugAvailable === true ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 size={12} /> {slugMessage || 'Workspace URL is available'}
                    </span>
                  ) : slugAvailable === false ? (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{slugMessage || 'URL taken'}</span>
                  ) : (
                    <span className="text-[var(--ink-muted)]">Your team will access HRDesk at this URL</span>
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={slugChecking || slugAvailable === false}
                  className="btn-primary flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>Continue to Admin Setup</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Administrator Credentials */}
          {step === 3 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="John Doe"
                    className="register-input !pl-9 text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Work Email *
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="john@acme.com"
                    className="register-input !pl-9 text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="register-input !pl-9 text-xs w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••"
                      className="register-input !pl-9 text-xs w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                    Confirm *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="register-input !pl-9 text-xs w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Head Office</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Head Office & Headcount */}
          {step === 4 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Primary Location / City
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai, Bengaluru, Delhi"
                    className="register-input !pl-9 text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] font-ui mb-1">
                  Estimated Employee Count
                </label>
                <div className="relative">
                  <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
                  <select
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className="register-input !pl-9 text-xs w-full"
                  >
                    <option value="1-10">1 – 10 employees</option>
                    <option value="11-50">11 – 50 employees</option>
                    <option value="51-200">51 – 200 employees</option>
                    <option value="201-500">201 – 500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              {/* Free Trial Banner */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-[var(--radius-md)] flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck size={18} className="shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <strong className="block font-semibold">14-Day Growth Enterprise Trial</strong>
                  <span>Automatic setup with sample departments, shifts, roles, and leave policies.</span>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep(3)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Workspace</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-[var(--rule)] pt-4 text-center">
            <p className="text-xs text-[var(--ink-muted)] font-ui">
              Already have an organization?{' '}
              <Link to="/auth/sign-in" className="font-semibold text-[var(--gold-600)] dark:text-[var(--gold-400)] hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
