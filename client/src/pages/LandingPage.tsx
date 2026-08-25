import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Users,
  CreditCard,
  Calendar,
  CheckCircle2,
  Receipt,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  MessageSquare,
  Sparkles,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  FileSpreadsheet,
  Check,
  ArrowUpRight,
  Globe,
  RotateCcw,
  Briefcase,
  ScanLine,
  Sliders,
  DollarSign,
  CheckCheck,
  MapPin,
  Flame,
  Award,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'face' | 'attendance' | 'payroll' | 'whatsapp' | 'branch'>('face');

  // ROI Calculator States
  const [employeeCount, setEmployeeCount] = useState<number>(75);
  const [branchCount, setBranchCount] = useState<number>(3);

  // Dynamic ROI Calculations
  const roiCalculations = useMemo(() => {
    const hoursSavedPerMonth = Math.round(employeeCount * 0.45 + branchCount * 6);
    const avgSalary = 32000;
    const leakagePrevented = Math.round(employeeCount * (avgSalary / 30) * 0.75);
    const payslipsAutomated = employeeCount;
    return {
      hoursSavedPerMonth,
      leakagePrevented,
      payslipsAutomated,
      roiMultiplier: (leakagePrevented / 2499).toFixed(1),
    };
  }, [employeeCount, branchCount]);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const plans = [
    {
      code: 'FREE_STARTER',
      name: 'Free Starter',
      tagline: 'Ideal for small startups & bootstrapping teams',
      priceMonthly: 0,
      priceYearly: 0,
      maxEmployees: 10,
      maxBranches: 1,
      popular: false,
      features: [
        'Up to 10 Active Employees',
        'Single Branch / Location',
        'Daily Attendance & Real-Time Punch Tracking',
        'Standard Leave Applications',
        'Community Support',
      ],
    },
    {
      code: 'STARTER_CORE',
      name: 'Starter Core',
      tagline: 'Perfect for growing businesses needing shifts & leaves',
      priceMonthly: 999,
      priceYearly: 10190,
      maxEmployees: 50,
      maxBranches: 2,
      popular: false,
      features: [
        'Up to 50 Active Employees',
        '2 Branches / Office Locations',
        'Automated Biometric Cloud Sync',
        'Multi-Shift Rostering & Night Shifts',
        'Full Leave & Holiday Management',
        'Standard Email Notifications',
      ],
    },
    {
      code: 'GROWTH_ENTERPRISE',
      name: 'Growth Enterprise',
      tagline: 'The ultimate engine for scaling companies & multi-branch firms',
      priceMonthly: 2499,
      priceYearly: 25490,
      maxEmployees: 250,
      maxBranches: 10,
      popular: true,
      badge: 'Most Popular',
      features: [
        'Up to 250 Active Employees',
        '10 Branch Locations with Geofencing',
        'Single Source of Truth Payroll & LOP Engine',
        'WhatsApp Automated Payslip Dispatch',
        'Employee Loan & Advance Tracking',
        'Enterprise Field-Level Audit Trails',
        'Priority Phone & WhatsApp Support',
      ],
    },
    {
      code: 'ENTERPRISE_CUSTOM',
      name: 'Enterprise Custom',
      tagline: 'For large conglomerates requiring unlimited scale & white-labeling',
      priceMonthly: 5999,
      priceYearly: 61190,
      maxEmployees: 1000,
      maxBranches: 50,
      popular: false,
      features: [
        'Unlimited Employee Capacity',
        'Unlimited Branches & Warehouses',
        'White-Label Custom Domain Routing',
        'Custom Brand Logo & Color Theming',
        'Dedicated Database Isolation Option',
        'Custom Integration & 99.9% Uptime SLA',
        '24/7 Dedicated Account Manager',
      ],
    },
  ];

  const faqs = [
    {
      q: 'Do we need to replace our existing attendance machines?',
      a: 'Not at all! HRDesk integrates seamlessly with standard attendance devices, cloud attendance hardware, and mobile GPS/facial punch devices via real-time API sync.',
    },
    {
      q: 'How fast can our company get started?',
      a: 'You can register a new organization in under 60 seconds. Our automated provisioning engine immediately sets up your departments, designations, shifts, leave types, and master roles.',
    },
    {
      q: 'How does the 14-day free trial work?',
      a: 'Every new workspace automatically gets a full 14-day free trial on the Growth Enterprise tier with zero credit card required. You can upgrade anytime or continue on the Free Starter plan.',
    },
    {
      q: 'How does WhatsApp payslip dispatch work?',
      a: 'When you finalize your monthly payroll run, one click automatically compiles individual encrypted PDF salary slips and dispatches them via our integrated WhatsApp gateway directly to your staff.',
    },
    {
      q: 'Is our company data securely isolated from other organizations?',
      a: 'Yes. HRDesk uses an enterprise-grade multi-tenant architecture with strict tenant isolation, role-based access control (RBAC), and bank-grade data security.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] font-ui selection:bg-[var(--gold-500)] selection:text-[var(--navy-900)]">
      {/* ═══════════════════════════════════════════
          1. STICKY TOP NAVBAR
      ═══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--surface)]/90 border-b border-[var(--rule)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded bg-[var(--gold-500)] text-[var(--navy-900)] flex items-center justify-center font-bold shadow-xs">
              <Building2 size={20} />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight text-[var(--ink)]">
                HRDesk<span className="text-[var(--gold-500)]">.</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/20">
                SaaS Enterprise
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[var(--ink-muted)]">
            <a href="#interactive-demo" className="hover:text-[var(--ink)] transition-colors text-[var(--gold-600)] dark:text-[var(--gold-400)] font-bold flex items-center gap-1">
              <Sparkles size={13} />
              <span>Interactive Studio</span>
            </a>
            <a href="#modules" className="hover:text-[var(--ink)] transition-colors">Core Modules</a>
            <a href="#calculator" className="hover:text-[var(--ink)] transition-colors">ROI Calculator</a>
            <a href="#pricing" className="hover:text-[var(--ink)] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--gold-600)] transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-primary text-xs py-1.5 px-4 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          2. HERO SECTION
      ═══════════════════════════════════════════ */}
      <section className="relative pt-16 pb-24 overflow-hidden border-b border-[var(--rule)]">
        {/* Modern Ambient Radial Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[var(--gold-500)]/12 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[250px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          {/* Top Innovation Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/25 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Next-Gen Enterprise Workforce & Payroll Operating System</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ink)] max-w-4xl mx-auto leading-[1.12]">
            The Modern HRMS, Attendance & Payroll Platform for Growing Teams
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-[var(--ink-muted)] max-w-2xl mx-auto leading-relaxed">
            Eliminate attendance calculation errors. Seamlessly manage employee attendance, multi-shift rosters, leave workflows, and automated 1-click WhatsApp payslips with zero discrepancy.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-sm py-3.5 px-7 font-bold flex items-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto justify-center hover:scale-[1.02] transition-transform"
              >
                <span>Open Workspace Dashboard</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => navigate('/register')}
                className="btn-primary text-sm py-3.5 px-7 font-bold flex items-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto justify-center hover:scale-[1.02] transition-transform"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight size={16} />
              </button>
            )}

            <a
              href="#interactive-demo"
              className="btn-secondary text-sm py-3.5 px-7 font-semibold flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center hover:bg-[var(--surface-sunken)] transition-colors"
            >
              <span>Explore Interactive Studio</span>
              <Sparkles size={15} className="text-[var(--gold-500)]" />
            </a>
          </div>

          {/* Trust Highlights */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Instant 60-Second Setup</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>No Credit Card Required</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Bank-Grade Data Security</span>
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          3. ⭐ INTERACTIVE PRODUCT STUDIO (LIVE UI SIMULATOR)
      ═══════════════════════════════════════════ */}
      <section id="interactive-demo" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-500)]/15 text-[var(--gold-600)] dark:text-[var(--gold-400)] text-xs font-bold uppercase tracking-wider">
              <Sparkles size={13} />
              <span>Interactive Product Explorer</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Experience the Real HRDesk Platform in Action
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Select an engine below to explore how HRDesk solves biometric synchronization, attendance discrepancies, and payroll calculations.
            </p>
          </div>

          {/* Studio Container */}
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-xl)] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Left Interactive Nav Column (5 cols) */}
            <div className="lg:col-span-4 p-5 bg-[var(--surface-sunken)]/60 border-b lg:border-b-0 lg:border-r border-[var(--rule)] space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider px-2 block mb-3">
                Core Engines
              </span>

              {[
                {
                  id: 'face' as const,
                  title: 'AI Face & GPS Punch Verification',
                  desc: 'Server-side neural 5-point landmark matching & geofencing.',
                  icon: ScanLine,
                  badge: '0.92 Match Score',
                },
                {
                  id: 'attendance' as const,
                  title: 'Live 31-Day Attendance Muster',
                  desc: 'Single source of truth with Comp-Off & LOP auto-sync.',
                  icon: Clock,
                  badge: 'Zero Discrepancy',
                },
                {
                  id: 'payroll' as const,
                  title: 'Single-Source Payroll & LOP Engine',
                  desc: 'Automated gross-to-net salary breakdown & deductions.',
                  icon: Receipt,
                  badge: '1-Click Calculation',
                },
                {
                  id: 'whatsapp' as const,
                  title: 'Automated WhatsApp Payslips',
                  desc: 'Direct encrypted PDF payslip dispatch to employee phones.',
                  icon: MessageSquare,
                  badge: 'Instant Delivery',
                },
                {
                  id: 'branch' as const,
                  title: 'Multi-Branch & GPS Geofencing',
                  desc: 'Independent office boundaries, shifts, and quotas.',
                  icon: MapPin,
                  badge: 'Multi-Location',
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full p-3.5 rounded-[var(--radius-md)] text-left transition-all cursor-pointer border flex flex-col gap-1.5 relative ${
                      isSelected
                        ? 'bg-[var(--surface)] border-[var(--gold-500)] shadow-sm text-[var(--ink)]'
                        : 'bg-transparent border-transparent hover:bg-[var(--surface)]/60 text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={isSelected ? 'text-[var(--gold-500)]' : 'text-[var(--ink-muted)]'} />
                        <span className={`text-xs font-bold ${isSelected ? 'text-[var(--ink)]' : ''}`}>
                          {tab.title}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] text-emerald-600">
                        {tab.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed pl-6">
                      {tab.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Right Live UI Mockup Viewport (7 cols) */}
            <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-center bg-[var(--surface)] relative overflow-hidden">
              {/* Tab 1: AI Face & GPS Punch */}
              {activeTab === 'face' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                        <ScanLine size={20} />
                      </div>
                      <div>
                        <h4 className="font-display text-base font-bold text-[var(--ink)]">Neural Face Verification Engine</h4>
                        <span className="text-xs text-[var(--ink-muted)]">ArcFace 128-D Model • Server-Side Validation</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>Face ID Matched (94%)</span>
                    </span>
                  </div>

                  {/* Face Camera Simulation Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Simulated Camera Window */}
                    <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] border border-[var(--rule)] space-y-3 text-center relative overflow-hidden">
                      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-emerald-500/20 to-[var(--gold-500)]/20 border-2 border-dashed border-emerald-500 flex items-center justify-center relative">
                        <div className="w-16 h-16 rounded-full bg-emerald-600/30 flex items-center justify-center">
                          <Users size={28} className="text-emerald-500" />
                        </div>
                        <span className="absolute -bottom-2 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white shadow-xs">
                          Live Liveness OK
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[var(--ink)]">Rajesh Sharma</div>
                        <div className="text-[11px] text-[var(--ink-muted)]">EMP #1042 • Engineering</div>
                      </div>
                      <div className="p-2 rounded bg-[var(--surface)] text-[10px] text-emerald-600 font-mono border border-emerald-500/20 flex items-center justify-between">
                        <span>Cosine Score: 0.941</span>
                        <span>Threshold: 0.400 ✓</span>
                      </div>
                    </div>

                    {/* Geofence Check */}
                    <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] border border-[var(--rule)] space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">GPS Perimeter Check</span>
                        <div className="flex items-center gap-2">
                          <MapPin size={18} className="text-[var(--gold-500)] shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-[var(--ink)]">Head Office — Floor 4</div>
                            <div className="text-[10px] text-[var(--ink-muted)]">Radius: 100m • Current: 18m from center</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                          <span className="text-[var(--ink-muted)]">Clock In Time:</span>
                          <strong className="text-[var(--ink)] font-data">09:28:14 AM (On Time)</strong>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[var(--ink-muted)]">Punch Source:</span>
                          <strong className="text-emerald-600 font-data">Mobile Face ID Verified</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Attendance Muster */}
              {activeTab === 'attendance' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">Monthly Attendance Muster Roll</h4>
                      <span className="text-xs text-[var(--ink-muted)]">Real-time daily punch logs • Auto Comp-Off & LOP calculation</span>
                    </div>
                    <span className="text-xs font-mono text-[var(--gold-600)] font-bold bg-[var(--gold-500)]/10 px-2.5 py-1 rounded">
                      Month: August 2026
                    </span>
                  </div>

                  {/* Muster Roll Table Mockup */}
                  <div className="border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden text-xs">
                    <div className="bg-[var(--surface-sunken)] p-2.5 font-bold flex items-center justify-between border-b border-[var(--rule)] text-[11px]">
                      <span>Employee Name</span>
                      <div className="flex items-center gap-4">
                        <span>Punches (Days 1–7)</span>
                        <span>Payable Days</span>
                      </div>
                    </div>

                    {[
                      { name: 'Amit Verma', role: 'Sr. Developer', p: ['P', 'P', 'P', 'COHF', 'P', 'WO', 'WO'], payable: '29.5 / 31' },
                      { name: 'Sneha Patel', role: 'HR Executive', p: ['P', 'P', 'A', 'P', 'P', 'WO', 'WO'], payable: '28.0 / 31' },
                      { name: 'Karan Mehra', role: 'Operations', p: ['P', 'P', 'P', 'P', 'P', 'WO', 'WO'], payable: '31.0 / 31' },
                    ].map((row, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between border-b border-[var(--rule)]/60 hover:bg-[var(--surface-sunken)]/40 transition-colors">
                        <div>
                          <div className="font-bold text-[var(--ink)]">{row.name}</div>
                          <div className="text-[10px] text-[var(--ink-muted)]">{row.role}</div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            {row.p.map((status, si) => (
                              <span
                                key={si}
                                className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${
                                  status === 'P'
                                    ? 'bg-emerald-500/15 text-emerald-600'
                                    : status === 'A'
                                    ? 'bg-rose-500/15 text-rose-600'
                                    : status === 'COHF'
                                    ? 'bg-indigo-500/15 text-indigo-600'
                                    : 'bg-blue-500/15 text-blue-600'
                                }`}
                              >
                                {status}
                              </span>
                            ))}
                          </div>
                          <span className="font-mono font-bold text-[var(--ink)] w-16 text-right">{row.payable}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
                    <CheckCheck size={16} />
                    <span>Attendance verified. 0 calculation discrepancies found.</span>
                  </div>
                </div>
              )}

              {/* Tab 3: Payroll Ledger */}
              {activeTab === 'payroll' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">1-Click Auto-Calculated Payroll</h4>
                      <span className="text-xs text-[var(--ink-muted)]">Tied directly to AttendanceSummaryService for zero errors</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Auto-Calculated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                      <span className="text-[10px] text-[var(--ink-muted)] block">Gross Salary</span>
                      <strong className="text-base font-bold text-[var(--ink)] font-data">{'\u20B9'}75,000</strong>
                    </div>
                    <div className="p-3 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                      <span className="text-[10px] text-rose-600 block">LOP Deduction (1.0d)</span>
                      <strong className="text-base font-bold text-rose-600 font-data">-{'\u20B9'}2,419</strong>
                    </div>
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-600 font-bold block">Net Payable Salary</span>
                      <strong className="text-base font-bold text-emerald-600 font-data">{'\u20B9'}72,581</strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--surface-sunken)]/50 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                      <span className="text-[var(--ink-muted)]">Comp-Off (COHF) Credit Added:</span>
                      <strong className="text-emerald-600 font-data">+0.5 Weekoff (+{'\u20B9'}1,210)</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                      <span className="text-[var(--ink-muted)]">Salary Advance EMI Deducted:</span>
                      <strong className="text-[var(--ink)] font-data">-{'\u20B9'}5,000 (Loan #LN-1002)</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[var(--ink-muted)]">Final Bank Transfer Amount:</span>
                      <strong className="text-emerald-600 font-bold font-data">{'\u20B9'}67,581</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: WhatsApp Payslip */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">WhatsApp Automated Payslip Dispatch</h4>
                      <span className="text-xs text-[var(--ink-muted)]">No printing, no manual emails. Direct WhatsApp delivery.</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                      <CheckCheck size={14} />
                      <span>Sent & Delivered</span>
                    </span>
                  </div>

                  {/* Simulated WhatsApp Chat Interface */}
                  <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)] border border-[var(--rule)] max-w-md mx-auto space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)] border-b border-[var(--rule)] pb-2">
                      <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-emerald-600" />
                        HRDesk Automated Payroll Bot
                      </span>
                      <span>10:02 AM</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-600/10 border border-emerald-500/25 space-y-2 text-xs">
                      <p className="text-[var(--ink)] leading-relaxed">
                        Hello <strong>Pooja</strong>, your salary slip for <strong>August 2026</strong> has been credited.
                      </p>
                      <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--rule)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📄</span>
                          <div>
                            <div className="font-bold text-xs text-[var(--ink)]">Payslip_Aug2026_Pooja.pdf</div>
                            <div className="text-[10px] text-[var(--ink-muted)]">Encrypted PDF • 142 KB</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer">
                          Download
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-emerald-600 pt-1">
                        <span>Net Credited: {'\u20B9'}68,450</span>
                        <span className="flex items-center gap-0.5"><CheckCheck size={12} /> Delivered</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Multi-Branch & Geofence */}
              {activeTab === 'branch' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">Multi-Branch Management & Geofencing</h4>
                      <span className="text-xs text-[var(--ink-muted)]">Manage separate locations with dedicated radius boundaries</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--gold-500)]/15 text-[var(--gold-600)] dark:text-[var(--gold-400)]">
                      3 Active Branches
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: 'Head Office', city: 'Mumbai', emps: 120, radius: '100m', active: true },
                      { name: 'Development Center', city: 'Bengaluru', emps: 85, radius: '150m', active: true },
                      { name: 'Logistics Warehouse', city: 'Pune', emps: 45, radius: '250m', active: true },
                    ].map((b, bi) => (
                      <div key={bi} className="p-3.5 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--surface-sunken)]/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--ink)]">{b.name}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="text-[11px] text-[var(--ink-muted)]">{b.city} • Radius {b.radius}</div>
                        <div className="text-xs font-bold text-[var(--gold-600)] dark:text-[var(--gold-400)] pt-1 border-t border-[var(--rule)]">
                          {b.emps} Active Staff
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] text-xs text-[var(--ink-muted)] flex items-center justify-between">
                    <span>Each branch operates with independent shifts, holiday schedules, and manager access scopes.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          4. ⭐ INTERACTIVE ROI & SAVINGS CALCULATOR
      ═══════════════════════════════════════════ */}
      <section id="calculator" className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold">
              <DollarSign size={13} />
              <span>Interactive Cost-Benefit Analysis</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Calculate Your Monthly Time & Money Savings
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              See how much time your HR team saves and how many calculation errors are prevented with HRDesk.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[var(--surface-sunken)]/40 p-6 sm:p-10 rounded-[var(--radius-xl)] border border-[var(--rule)]">
            {/* Left Sliders Controls (6 cols) */}
            <div className="lg:col-span-6 space-y-8">
              {/* Slider 1: Employees */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                    Total Active Employees
                  </label>
                  <span className="text-lg font-bold font-data text-[var(--gold-600)] dark:text-[var(--gold-400)] px-3 py-1 bg-[var(--surface)] rounded border border-[var(--rule)]">
                    {employeeCount} Staff
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(Number(e.target.value))}
                  className="w-full accent-[var(--gold-500)] cursor-pointer h-2 bg-[var(--surface-sunken)] rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                  <span>10 Employees</span>
                  <span>250 Employees</span>
                  <span>500+ Employees</span>
                </div>
              </div>

              {/* Slider 2: Branches */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                    Office / Branch Locations
                  </label>
                  <span className="text-lg font-bold font-data text-emerald-600 px-3 py-1 bg-[var(--surface)] rounded border border-[var(--rule)]">
                    {branchCount} {branchCount === 1 ? 'Branch' : 'Branches'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={branchCount}
                  onChange={(e) => setBranchCount(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-[var(--surface-sunken)] rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                  <span>1 Location</span>
                  <span>10 Locations</span>
                  <span>20 Locations</span>
                </div>
              </div>

              <div className="p-4 rounded bg-[var(--surface)] border border-[var(--rule)] text-xs text-[var(--ink-muted)] flex items-center gap-3">
                <Flame size={18} className="text-amber-500 shrink-0" />
                <span>
                  HRDesk eliminates double-entry errors between biometric punches, muster sheets, and bank salary disbursements.
                </span>
              </div>
            </div>

            {/* Right Live Computed Results (6 cols) */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--rule)] shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">HR Hours Saved / Mo</span>
                <div className="font-display text-3xl sm:text-4xl font-bold text-[var(--gold-500)]">
                  ~{roiCalculations.hoursSavedPerMonth} hrs
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">Reconciliation & manual calculation eliminated.</p>
              </div>

              <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--rule)] shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-emerald-600 uppercase">LOP Leakage Prevented</span>
                <div className="font-display text-3xl sm:text-4xl font-bold text-emerald-600 font-data">
                  {'\u20B9'}{roiCalculations.leakagePrevented.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">Comp-Off & unapproved absence tracking.</p>
              </div>

              <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--rule)] shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">WhatsApp Payslips</span>
                <div className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] font-data">
                  {roiCalculations.payslipsAutomated} / mo
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">Delivered in 1 click at month-end.</p>
              </div>

              <div className="p-6 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--gold-500)]/15 to-emerald-500/15 border border-[var(--gold-500)]/30 shadow-sm space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[var(--gold-600)] dark:text-[var(--gold-400)] uppercase">Estimated SaaS ROI</span>
                  <div className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
                    {roiCalculations.roiMultiplier}x
                  </div>
                </div>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-primary text-xs py-2 px-3 font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Start Saving Today</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          5. ⭐ BENTO GRID: 12 CORE PLATFORM MODULES (#modules)
      ═══════════════════════════════════════════ */}
      <section id="modules" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Enterprise Feature Matrix
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              All 12 Integrated Core Modules
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              A comprehensive people operations architecture designed to handle every stage of your workforce lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Clock,
                title: 'Real-Time Attendance & Shifts',
                desc: 'Rotational shifts, night shifts, automated late-in & early-out grace rules, overtime tracking, and 31-day team muster roll.',
                badge: 'Core Engine',
              },
              {
                icon: ScanLine,
                title: 'Face ID & Mobile GPS Punch',
                desc: 'Server-side neural face verification with 5-point landmark alignment, anti-spoof liveness check, and geofenced office radius validation.',
                badge: 'AI & Mobile',
              },
              {
                icon: Receipt,
                title: 'Single-Source Payroll & LOP Engine',
                desc: 'Automatic Loss of Pay (LOP) deductions, Comp-Off (CO/COHF) credit rules, gross-to-net calculations, and complete salary ledgers.',
                badge: 'Zero Discrepancy',
              },
              {
                icon: MessageSquare,
                title: 'WhatsApp Automated Payslips',
                desc: '1-click compilation and direct delivery of PDF payslips to employee WhatsApp numbers with instant delivery receipts.',
                badge: 'Instant Delivery',
              },
              {
                icon: Calendar,
                title: 'Leave & Holiday Management',
                desc: 'Custom paid leave types (PL, SL, CO, LWP), annual quota balances, sandwich rules, multi-tier approvals, and holiday calendars.',
                badge: 'Multi-Tier Approvals',
              },
              {
                icon: CreditCard,
                title: 'Loans & Salary Advances',
                desc: 'Employee advance requests, customizable tenure plans, automatic payroll EMI deductions, and transparent repayment schedules.',
                badge: 'Auto EMI Deduct',
              },
              {
                icon: RotateCcw,
                title: 'Attendance Regularization',
                desc: 'Seamless employee self-service to resolve missed punches, with manager verification and automatic record adjustments.',
                badge: 'Self-Service',
              },
              {
                icon: Building2,
                title: 'Multi-Branch & Department Masters',
                desc: 'Manage multiple offices and warehouses under one organization with distinct GPS geofences, custom department structures, and designations.',
                badge: 'Multi-Branch',
              },
              {
                icon: Briefcase,
                title: 'Recruitment & Applicant Pipeline',
                desc: 'Full ATS lifecycle: job openings, candidate pipeline stages, interview scheduling, evaluation notes, and 1-click onboarding conversion.',
                badge: 'Full ATS Suite',
              },
              {
                icon: ShieldCheck,
                title: 'Granular RBAC & Audit Trails',
                desc: 'Row-level access scoping (All, Reporting Team, Department, Own) with field-by-field JSON before/after audit tracking for compliance.',
                badge: 'Enterprise Security',
              },
              {
                icon: Globe,
                title: 'Multi-Tenant SaaS Subscriptions',
                desc: 'Automated workspace provisioning in 60 seconds, custom workspace slugs, quota enforcement, and integrated subscription billing.',
                badge: '100% White-Label',
              },
              {
                icon: Smartphone,
                title: 'Cross-Platform Mobile App',
                desc: 'Native Flutter app for iOS & Android with live shift countdown, instant punch-in, leave balances, loan ledger, and Light/Dark themes.',
                badge: 'iOS & Android',
              },
            ].map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={idx}
                  className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--rule)] hover:border-[var(--gold-500)]/60 hover:shadow-md transition-all space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                      {m.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--gold-600)] dark:group-hover:text-[var(--gold-400)] transition-colors">
                    {m.title}
                  </h3>

                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          6. 3-STEP WORKFLOW (#workflow)
      ═══════════════════════════════════════════ */}
      <section id="workflow" className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Simple 3-Step Setup
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Get Your Organization Live in Minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                navigate('/register');
              }}
              className="bg-[var(--surface-sunken)]/60 p-6 rounded-[var(--radius-lg)] border border-[var(--rule)] hover:border-[var(--gold-500)]/80 shadow-xs hover:shadow-md transition-all space-y-3 relative cursor-pointer group"
            >
              <div className="text-2xl font-display font-bold text-[var(--gold-500)]">01</div>
              <h3 className="font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--gold-600)] dark:group-hover:text-[var(--gold-400)] transition-colors flex items-center justify-between">
                <span>Self-Serve Provisioning</span>
                <ArrowRight size={16} className="text-[var(--gold-500)] group-hover:translate-x-1 transition-transform" />
              </h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Enter your company details at <span className="text-[var(--gold-600)] dark:text-[var(--gold-400)] font-bold underline">/register</span>. Our system creates your organization, departments, roles, shifts, and 14-day trial in 60 seconds.
              </p>
            </div>

            <div className="bg-[var(--surface-sunken)]/60 p-6 rounded-[var(--radius-lg)] border border-[var(--rule)] space-y-3 relative">
              <div className="text-2xl font-display font-bold text-[var(--gold-500)]">02</div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">Setup Attendance & Staff</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Connect your office attendance devices via Cloud Sync API or enable GPS mobile self-punching for your field workforce.
              </p>
            </div>

            <div className="bg-[var(--surface-sunken)]/60 p-6 rounded-[var(--radius-lg)] border border-[var(--rule)] space-y-3 relative">
              <div className="text-2xl font-display font-bold text-[var(--gold-500)]">03</div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">Run 1-Click Payroll</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Calculate month-end salaries with zero discrepancies, deduct exact LOP, credit Comp-Offs, and dispatch payslips over WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          7. PRICING PLANS (#pricing)
      ═══════════════════════════════════════════ */}
      <section id="pricing" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Transparent Pricing
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Choose the Perfect Plan for Your Team
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              All plans include full attendance integration, leave tracking, and enterprise security. Upgrade or downgrade anytime.
            </p>

            {/* Monthly / Yearly Switcher */}
            <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface)] border border-[var(--rule)] mt-2 shadow-xs">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[var(--surface-sunken)] text-[var(--ink)] shadow-xs'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-[var(--gold-500)] text-[var(--navy-900)] shadow-xs'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                <span>Annual Billing</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-600 text-white font-bold">15% OFF</span>
              </button>
            </div>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {plans.map((p, idx) => {
              const price = billingCycle === 'yearly' ? Math.round(p.priceYearly / 12) : p.priceMonthly;
              return (
                <div
                  key={idx}
                  className={`bg-[var(--surface)] rounded-[var(--radius-lg)] border p-6 flex flex-col justify-between transition-all relative ${
                    p.popular
                      ? 'border-[var(--gold-500)] shadow-xl ring-2 ring-[var(--gold-500)]/20'
                      : 'border-[var(--rule)] hover:border-[var(--rule-bold)] shadow-xs'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--gold-500)] text-[var(--navy-900)] text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      {p.badge ?? 'Most Popular'}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Header */}
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--ink)]">{p.name}</h3>
                      <p className="text-[11px] text-[var(--ink-muted)] mt-1 min-h-[32px]">{p.tagline}</p>
                    </div>

                    {/* Price */}
                    <div className="py-2 border-y border-[var(--rule)]">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-bold text-[var(--ink)]">
                          {price === 0 ? 'Free' : `\u20B9${price.toLocaleString('en-IN')}`}
                        </span>
                        {price > 0 && <span className="text-[10px] text-[var(--ink-muted)]">/ mo</span>}
                      </div>
                      {billingCycle === 'yearly' && p.priceYearly > 0 && (
                        <span className="text-[10px] text-emerald-600 block mt-0.5">
                          Billed annually at {'\u20B9'}{p.priceYearly.toLocaleString('en-IN')}/yr
                        </span>
                      )}
                    </div>

                    {/* Quota Highlights */}
                    <div className="space-y-1.5 text-xs text-[var(--ink)]">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-[var(--gold-500)]" />
                        <span><strong>{p.maxEmployees}</strong> Employees Max</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-[var(--gold-500)]" />
                        <span><strong>{p.maxBranches}</strong> {p.maxBranches === 1 ? 'Branch' : 'Branches'}</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block">Included Features</span>
                      <ul className="space-y-2 text-xs">
                        {p.features.map((feat, fi) => (
                          <li key={fi} className="flex items-start gap-2 text-[var(--ink)]">
                            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      navigate(`/register?plan=${p.code}`);
                    }}
                    className={`w-full py-2.5 px-4 text-xs font-bold rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-6 ${
                      p.popular
                        ? 'btn-primary shadow-sm'
                        : 'border border-[var(--rule)] bg-[var(--surface-sunken)] hover:bg-[var(--surface)] text-[var(--ink)]'
                    }`}
                  >
                    <span>Start 14-Day Trial</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          8. FAQ ACCORDION (#faq)
      ═══════════════════════════════════════════ */}
      <section id="faq" className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Got Questions?
            </span>
            <h2 className="font-display text-3xl font-bold text-[var(--ink)]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div
                key={i}
                className="bg-[var(--surface-sunken)]/40 border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-[var(--ink)] hover:text-[var(--gold-600)] cursor-pointer"
                >
                  <span className="pr-4">{f.q}</span>
                  {expandedFaq === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 text-xs text-[var(--ink-muted)] leading-relaxed border-t border-[var(--rule)]/50 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          9. BOTTOM CALL TO ACTION BANNER
      ═══════════════════════════════════════════ */}
      <section className="py-20 text-center relative overflow-hidden bg-[var(--surface-sunken)]/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-[var(--ink)] tracking-tight">
            Ready to Automate Your Workforce Operations?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-muted)] max-w-xl mx-auto">
            Join growing enterprises that rely on HRDesk for zero-discrepancy attendance, automated leaves, and payroll.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                navigate('/register');
              }}
              className="btn-primary text-sm py-3.5 px-8 font-bold flex items-center gap-2 cursor-pointer shadow-lg mx-auto hover:scale-[1.02] transition-transform"
            >
              <span>Create Your Organization Now</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          10. FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="bg-[var(--surface)] border-t border-[var(--rule)] py-12 text-xs text-[var(--ink-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[var(--gold-500)] text-[var(--navy-900)] flex items-center justify-center font-bold text-xs">
              <Building2 size={14} />
            </div>
            <span className="font-display font-bold text-sm text-[var(--ink)]">HRDesk Platform</span>
            <span className="text-[10px] text-[var(--ink-muted)] ml-2">© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <a href="#interactive-demo" className="hover:text-[var(--ink)]">Interactive Studio</a>
            <a href="#modules" className="hover:text-[var(--ink)]">Core Modules</a>
            <a href="#calculator" className="hover:text-[var(--ink)]">ROI Calculator</a>
            <a href="#pricing" className="hover:text-[var(--ink)]">Pricing</a>
            <Link to="/login" className="hover:text-[var(--ink)]">Sign In</Link>
            <Link to="/register" className="hover:text-[var(--ink)] font-semibold text-[var(--gold-600)]">Register Workspace</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
