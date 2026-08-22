import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Calendar,
  Search,
  CheckCircle2,
  Receipt,
  X,
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
  HelpCircle,
  ArrowUpRight,
  Globe,
  Palette,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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
        'Basic Daily Attendance & Biometrics',
        'Standard Leave Applications',
        'Community Support',
      ],
    },
    {
      code: 'STARTER_CORE',
      name: 'Starter Core',
      tagline: 'Perfect for growing businesses needing shifts & leaves',
      priceMonthly: 999,
      priceYearly: 10190, // ~15% off
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
      priceYearly: 25490, // ~15% off
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

  const features = [
    {
      icon: Cpu,
      title: 'Biometric Cloud Sync & Geofencing',
      desc: 'Seamless real-time punch synchronization with TeamOffice, eTimeTrack, and biometric machines. Field staff self-punch with GPS radius checks.',
      badge: 'Hardware Agnostic',
    },
    {
      icon: FileSpreadsheet,
      title: 'Single-Source-of-Truth Payroll',
      desc: 'Never suffer calculation discrepancies. AttendanceSummaryService unifies monthly attendance, Comp-Off (CO/COHF) credits, and exact LOP deductions.',
      badge: 'Zero Discrepancy',
    },
    {
      icon: Layers,
      title: 'Intelligent Shift Matrix & Rostering',
      desc: 'Manage general, rotational, and night shifts. Auto-calculate late-in penalties, early departures, and overtime with customizable grace periods.',
      badge: 'Auto Rotation',
    },
    {
      icon: MessageSquare,
      title: 'WhatsApp Automation & Alerts',
      desc: 'One-click salary slip PDF dispatch directly to employee WhatsApp numbers. Instant alerts for missing punches, late arrivals, and approvals.',
      badge: 'Instant Delivery',
    },
    {
      icon: ShieldCheck,
      title: 'Enterprise Audit Trails & Compliance',
      desc: 'Track every CREATE, UPDATE, and DELETE with before-and-after JSON field diffs, IP addresses, and user timestamps for full regulatory compliance.',
      badge: 'SOC2 / ISO Ready',
    },
    {
      icon: Palette,
      title: 'Multi-Tenant White-Label Branding',
      desc: 'Deliver a branded experience for your company or clients with custom workspace slugs, custom domain mapping, logos, and personalized color themes.',
      badge: '100% White-Label',
    },
  ];

  const faqs = [
    {
      q: 'Do we need to replace our existing biometric machines?',
      a: 'Not at all! HRDesk integrates seamlessly with all standard biometric hardware and cloud providers (including TeamOffice, eTimeTrack, ZKTeco, and Realtime) using standard API sync.',
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
      a: 'When you finalize your monthly payroll run, one click automatically compiles individual PDF salary slips and dispatches them via our integrated WhatsApp gateway directly to your staff.',
    },
    {
      q: 'Is our company data securely isolated from other organizations?',
      a: 'Yes. HRDesk uses an enterprise-grade multi-tenant architecture with tenant scoping enforced at the database query level (EF Core Query Filters) and IPermissionService RBAC authorization.',
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
            <a href="#features" className="hover:text-[var(--ink)] transition-colors">Features</a>
            <a href="#modules" className="hover:text-[var(--ink)] transition-colors">Core Modules</a>
            <a href="#workflow" className="hover:text-[var(--ink)] transition-colors">How It Works</a>
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
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-[var(--rule)]">
        {/* Subtle Background Glow Elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[var(--gold-500)]/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/20 text-xs font-semibold animate-fade-in">
            <Sparkles size={13} className="text-[var(--gold-500)]" />
            <span>Next-Generation Multi-Tenant People & Attendance Platform</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ink)] max-w-4xl mx-auto leading-[1.15]">
            The Unified HRMS, Biometrics & Payroll SaaS for Growing Teams
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-[var(--ink-muted)] max-w-2xl mx-auto leading-relaxed">
            Eliminate attendance calculation errors. Seamlessly sync biometric devices, automate single-source-of-truth payroll, manage multi-shift rosters, and dispatch payslips over WhatsApp.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-sm py-3 px-6 font-bold flex items-center gap-2 cursor-pointer shadow-md w-full sm:w-auto justify-center"
              >
                <span>Open Workspace Dashboard</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => navigate('/register')}
                className="btn-primary text-sm py-3 px-6 font-bold flex items-center gap-2 cursor-pointer shadow-md w-full sm:w-auto justify-center"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight size={16} />
              </button>
            )}

            <a
              href="#pricing"
              className="btn-secondary text-sm py-3 px-6 font-semibold flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
            >
              <span>Explore Pricing Plans</span>
              <ArrowUpRight size={15} />
            </a>
          </div>

          {/* Trust Highlights */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--ink-muted)]">
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
              <span>MS SQL Enterprise Security</span>
            </span>
          </div>

          {/* ═══════════════════════════════════════════
              LIVE INTERACTIVE PRODUCT SNAPSHOT MOCKUP
          ═══════════════════════════════════════════ */}
          <div className="mt-12 max-w-5xl mx-auto bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden text-left font-ui">
            {/* Mockup Title Bar */}
            <div className="bg-[var(--surface-sunken)] px-4 py-3 border-b border-[var(--rule)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="font-mono text-[11px] text-[var(--ink-muted)] ml-2">app.hrdesk.com/attendance/live-ledger</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Biometric Hardware: Online (1,220 Punches Synced)</span>
              </div>
            </div>

            {/* Mockup Content Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[var(--surface)]">
              {/* Card 1: Attendance Engine */}
              <div className="p-4 rounded border border-[var(--rule)] bg-[var(--surface-sunken)]/40 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Clock size={14} className="text-[var(--gold-500)]" />
                    Attendance Summary
                  </span>
                  <span className="text-[10px] font-mono text-[var(--gold-600)] font-bold">Single Source of Truth</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                    <span className="text-[var(--ink-muted)]">Payable Days:</span>
                    <strong className="text-[var(--ink)] font-data">28.5 Days</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                    <span className="text-[var(--ink-muted)]">Comp Off Credit (COHF):</span>
                    <strong className="text-emerald-600 font-data">+0.5 W/O (0.5 Present)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--ink-muted)]">Loss of Pay (LOP):</span>
                    <strong className="text-rose-600 font-data">0.5 Days</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Automated Payroll Ledger */}
              <div className="p-4 rounded border border-[var(--rule)] bg-[var(--surface-sunken)]/40 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Receipt size={14} className="text-[var(--gold-500)]" />
                    Payroll Auto-Calculation
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">Ready to Process</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                    <span className="text-[var(--ink-muted)]">Gross CTC:</span>
                    <strong className="text-[var(--ink)] font-data">{'\u20B9'}65,000</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                    <span className="text-[var(--ink-muted)]">LOP Deduction (0.5d):</span>
                    <strong className="text-rose-600 font-data">-{'\u20B9'}1,083</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--ink-muted)]">Net Payable Salary:</span>
                    <strong className="text-emerald-600 font-bold font-data">{'\u20B9'}63,917</strong>
                  </div>
                </div>
              </div>

              {/* Card 3: WhatsApp Automation */}
              <div className="p-4 rounded border border-[var(--rule)] bg-[var(--surface-sunken)]/40 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-emerald-600" />
                    WhatsApp Payslip Dispatch
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Delivered
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--rule)] text-[10px] space-y-1">
                  <span className="text-emerald-600 font-bold block">📄 Payslip_Aug2026.pdf</span>
                  <p className="text-[var(--ink-muted)]">
                    "Hi Rajesh, your salary slip for August 2026 has been generated. Net credited: {'\u20B9'}63,917."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          3. CORE MODULES & FEATURES GRID (#features)
      ═══════════════════════════════════════════ */}
      <section id="features" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Comprehensive Platform Capabilities
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Everything Your Enterprise Needs to Run People Operations
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Designed from the ground up to replace fragmented spreadsheets, disconnected biometric software, and manual payroll headaches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-[var(--surface)] p-6 rounded-[var(--radius-md)] border border-[var(--rule)] shadow-xs hover:border-[var(--gold-500)]/50 transition-all space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--gold-600)] dark:group-hover:text-[var(--gold-400)] transition-colors">
                    {f.title}
                  </h3>

                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          4. HOW IT WORKS / WORKFLOW (#workflow)
      ═══════════════════════════════════════════ */}
      <section id="workflow" className="py-20 border-b border-[var(--rule)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Effortless Setup
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Up and Running in 3 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-md)] border border-[var(--rule)] space-y-3 relative">
              <div className="text-2xl font-display font-bold text-[var(--gold-500)]">01</div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">Self-Serve Provisioning</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Enter your company details at <Link to="/register" className="text-[var(--gold-600)] underline">/register</Link>. Our system creates your organization, departments, roles, shifts, and 14-day trial in 60 seconds.
              </p>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-md)] border border-[var(--rule)] space-y-3 relative">
              <div className="text-2xl font-display font-bold text-[var(--gold-500)]">02</div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">Sync Biometrics & Staff</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Connect your branch biometric devices via Cloud Sync API or enable GPS mobile self-punching for your field workforce.
              </p>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-md)] border border-[var(--rule)] space-y-3 relative">
              <div className="text-2xl font-display font-bold text-[var(--gold-500)]">03</div>
              <h3 className="font-display text-base font-bold text-[var(--ink)]">1-Click Payroll & WhatsApp</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Review automated attendance ledgers, calculate single-source-of-truth payroll with zero LOP disputes, and dispatch payslips directly to WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          5. TRANSPARENT PRICING MATRIX (#pricing)
      ═══════════════════════════════════════════ */}
      <section id="pricing" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Transparent, Scalable Pricing
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Choose the Perfect Plan for Your Team
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              All plans include full biometric integration, leave tracking, and standard security. Upgrade or downgrade anytime.
            </p>

            {/* Monthly / Yearly Switcher */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <span className={`text-xs font-semibold ${billingCycle === 'monthly' ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}>
                Monthly Billing
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="w-12 h-6 rounded-full bg-[var(--surface)] border border-[var(--rule)] p-1 flex items-center cursor-pointer transition-colors relative"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--gold-500)] transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}>
                <span>Yearly Billing</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Save 15%
                </span>
              </span>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => {
              const price = billingCycle === 'monthly' ? p.priceMonthly : Math.round(p.priceYearly / 12);
              return (
                <div
                  key={p.code}
                  className={`bg-[var(--surface)] rounded-[var(--radius-md)] border p-6 flex flex-col justify-between space-y-6 relative transition-all ${
                    p.popular
                      ? 'border-[var(--gold-500)] shadow-lg ring-1 ring-[var(--gold-500)]/30'
                      : 'border-[var(--rule)] shadow-xs'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--gold-500)] text-[var(--navy-900)] text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      {p.badge}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--ink)]">{p.name}</h3>
                      <p className="text-[11px] text-[var(--ink-muted)] mt-1 min-h-[32px]">{p.tagline}</p>
                    </div>

                    <div className="border-y border-[var(--rule)] py-3">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-bold text-[var(--ink)]">
                          {'\u20B9'}{price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-[var(--ink-muted)]">/month</span>
                      </div>
                      <span className="text-[10px] text-[var(--ink-muted)] block mt-0.5">
                        {billingCycle === 'yearly' && price > 0 ? `Billed annually at \u20B9${p.priceYearly.toLocaleString('en-IN')}` : 'Billed monthly'}
                      </span>
                    </div>

                    {/* Quota Limits */}
                    <div className="text-xs space-y-1">
                      <div className="text-[var(--ink)] font-semibold">
                        Capacity: {p.maxEmployees} Seats • {p.maxBranches} Location{p.maxBranches > 1 ? 's' : ''}
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
                    onClick={() => navigate(`/register?plan=${p.code}`)}
                    className={`w-full py-2.5 px-4 text-xs font-bold rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
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
          6. ENTERPRISE SECURITY BANNER (#security)
      ═══════════════════════════════════════════ */}
      <section id="security" className="py-16 border-b border-[var(--rule)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[var(--surface-sunken)] border border-[var(--rule)] rounded-[var(--radius-lg)] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase">
                <Lock size={15} />
                <span>Enterprise Security & Multi-Tenancy</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                Built on Microsoft SQL Server with Total Data Isolation
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-muted)] leading-relaxed">
                Your employee records, salary slips, and punch logs are protected by strict row-level schema scoping (`IPermissionService`), automatic EF Core ChangeTracker audit diffs, and 256-bit encryption.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0">
              <div className="p-4 bg-[var(--surface)] rounded border border-[var(--rule)] text-center">
                <div className="font-display text-2xl font-bold text-[var(--gold-500)]">99.9%</div>
                <span className="text-[11px] text-[var(--ink-muted)]">Punch Sync SLA</span>
              </div>
              <div className="p-4 bg-[var(--surface)] rounded border border-[var(--rule)] text-center">
                <div className="font-display text-2xl font-bold text-emerald-600">100%</div>
                <span className="text-[11px] text-[var(--ink-muted)]">Audit Logging</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          7. FAQ ACCORDION (#faq)
      ═══════════════════════════════════════════ */}
      <section id="faq" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/30">
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
                className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden transition-colors"
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
          8. BOTTOM CALL TO ACTION BANNER
      ═══════════════════════════════════════════ */}
      <section className="py-20 text-center relative overflow-hidden bg-[var(--surface)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-[var(--ink)] tracking-tight">
            Ready to Automate Your Workforce Operations?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-muted)] max-w-xl mx-auto">
            Join growing enterprises that rely on HRDesk for zero-discrepancy attendance, biometrics, and payroll.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/register')}
              className="btn-primary text-sm py-3.5 px-8 font-bold flex items-center gap-2 cursor-pointer shadow-lg mx-auto"
            >
              <span>Create Your Organization Now</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          9. FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="bg-[var(--surface-sunken)] border-t border-[var(--rule)] py-12 text-xs text-[var(--ink-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[var(--gold-500)] text-[var(--navy-900)] flex items-center justify-center font-bold text-xs">
              <Building2 size={14} />
            </div>
            <span className="font-display font-bold text-sm text-[var(--ink)]">HRDesk Platform</span>
            <span className="text-[10px] text-[var(--ink-muted)] ml-2">© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <a href="#features" className="hover:text-[var(--ink)]">Features</a>
            <a href="#pricing" className="hover:text-[var(--ink)]">Pricing</a>
            <Link to="/login" className="hover:text-[var(--ink)]">Sign In</Link>
            <Link to="/register" className="hover:text-[var(--ink)] font-semibold text-[var(--gold-600)]">Register Workspace</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
