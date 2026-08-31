import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import {
  Building2,
  Users,
  CreditCard,
  Calendar,
  CheckCircle2,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  MessageSquare,
  Sparkles,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Check,
  Globe,
  RotateCcw,
  Briefcase,
  ScanLine,
  DollarSign,
  CheckCheck,
  MapPin,
  Flame,
  Star,
  FileText,
  Shield,
  ShoppingBag,
  Stethoscope,
  HardHat,
  Factory,
  Camera,
  Play,
  RefreshCw,
  Sun,
  Moon,
  TrendingUp,
  XCircle,
  Award,
  Layers,
  ArrowUpRight,
  Sliders,
  Send,
  Lock,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<'face' | 'shifts' | 'attendance' | 'payroll' | 'whatsapp'>('face');

  // 1. Live Interactive Face Punch State (Rippling/Linear inspired)
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(true);
  const [lastPunchTime, setLastPunchTime] = useState('09:28:14 AM');
  const [livePunchesCount, setLivePunchesCount] = useState(1482);

  // 2. Interactive WhatsApp Payslip Customizer State (Gusto/Deel inspired)
  const [payslipSalary, setPayslipSalary] = useState(45000);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsAppDelivered, setWhatsAppDelivered] = useState(true);

  // 3. Interactive Shift Visualizer State
  const [activeShiftType, setActiveShiftType] = useState<'day' | 'night' | 'rotational'>('day');

  // 4. ROI Calculator States (Deel inspired)
  const [employeeCount, setEmployeeCount] = useState<number>(50);
  const [branchCount, setBranchCount] = useState<number>(2);

  // Dynamic ROI Calculations
  const roiCalculations = useMemo(() => {
    const hoursSavedPerMonth = Math.round(employeeCount * 0.45 + branchCount * 5);
    const avgSalary = 28000;
    const leakagePrevented = Math.round(employeeCount * (avgSalary / 30) * 0.75);
    const payslipsAutomated = employeeCount;
    const roiMultiplier = Math.max(2.5, Number((leakagePrevented / 2499).toFixed(1)));
    return {
      hoursSavedPerMonth,
      leakagePrevented,
      payslipsAutomated,
      roiMultiplier,
    };
  }, [employeeCount, branchCount]);

  // Handle Live Simulated Face Punch
  const handleSimulatePunch = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanSuccess(false);

    setTimeout(() => {
      setIsScanning(false);
      setScanSuccess(true);
      const now = new Date();
      setLastPunchTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLivePunchesCount((prev) => prev + 1);
    }, 1300);
  };

  // Handle WhatsApp Payslip Regeneration
  const handleRegeneratePayslip = (newSalary: number) => {
    setPayslipSalary(newSalary);
    setIsSendingWhatsApp(true);
    setWhatsAppDelivered(false);
    setTimeout(() => {
      setIsSendingWhatsApp(false);
      setWhatsAppDelivered(true);
    }, 700);
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // Dynamic plans from API with sensible defaults
  const [plans, setPlans] = useState<any[]>([
    {
      code: 'starter',
      name: 'Starter',
      tagline: 'Ideal for small offices, clinics, and single-location businesses.',
      priceMonthly: 999,
      priceYearly: Math.round(999 * 12 * 0.85),
      maxEmployees: 25,
      maxBranches: 1,
      popular: false,
      features: [
        'Up to 25 Active Employees',
        '1 Office / Branch Location',
        'Mobile Selfie Face Attendance & GPS',
        'Leave & Holiday Management',
        'Attendance Muster Excel Exports',
      ],
    },
    {
      code: 'growth',
      name: 'Growth Enterprise',
      tagline: 'For growing companies needing automated WhatsApp payroll & multi-branch.',
      priceMonthly: 2499,
      priceYearly: Math.round(2499 * 12 * 0.85),
      maxEmployees: 100,
      maxBranches: 5,
      popular: true,
      badge: 'Most Popular',
      features: [
        'Up to 100 Active Employees',
        '5 Branches with GPS Geofencing',
        '1-Click Automated Payroll Calculation',
        'Instant WhatsApp PDF Salary Slips',
        'Employee Loans & Salary Advance EMI',
        'Manager & Department Access Controls',
      ],
    },
    {
      code: 'enterprise',
      name: 'Corporate Scale',
      tagline: 'For large organizations, multi-store chains, and factory units.',
      priceMonthly: 5999,
      priceYearly: Math.round(5999 * 12 * 0.85),
      maxEmployees: 500,
      maxBranches: 25,
      popular: false,
      features: [
        'Up to 500 Active Employees',
        '25 Branches & Custom Shifts',
        'Recruitment & Candidate Hiring Pipeline',
        'Dedicated Onboarding Setup & WhatsApp Support',
        'Biometric Device API & Cloud Sync',
        'Custom Roles & Field Permissions',
      ],
    },
  ]);

  useEffect(() => {
    apiClient
      .get('/subscription/plans')
      .then((res) => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const fetched = res.data.map((p: any) => {
            const features: string[] = [];
            features.push(`Up to ${p.maxEmployees?.toLocaleString() || 25} Active Employees`);
            features.push(`${p.maxBranches} Branch${p.maxBranches > 1 ? 'es' : ''} / Location${p.maxBranches > 1 ? 's' : ''}`);
            if (p.hasBiometricsModule) features.push('Biometric & Mobile Face Attendance');
            if (p.hasPayrollModule) features.push('1-Click Payroll & WhatsApp Payslips');
            if (p.hasRecruitmentModule) features.push('Recruitment & Hiring Pipeline');
            if (p.hasLoanManagement) features.push('Employee Loans & Advance EMI');
            if (p.hasCustomDomain) features.push('White-Label Custom Domain');
            if (features.length < 4) features.push('Role Permissions & Audit Logs');
            return {
              code: p.code,
              name: p.name,
              tagline: p.description || 'Attendance, leave and payroll management.',
              priceMonthly: p.pricePerMonth || 0,
              priceYearly: Math.round((p.pricePerMonth || 0) * 12 * 0.85),
              maxEmployees: p.maxEmployees,
              maxBranches: p.maxBranches,
              popular: p.code === 'growth',
              badge: p.code === 'growth' ? 'Most Popular' : undefined,
              features,
            };
          });
          setPlans(fetched);
        }
      })
      .catch(() => {});
  }, []);

  const faqs = [
    {
      q: 'Can any type of company use HRDesk?',
      a: 'Yes! Whether you operate a corporate office, retail chain, construction company, healthcare clinic, manufacturing facility, or service consultancy — HRDesk scales effortlessly for any business with 5 to 500+ employees.',
    },
    {
      q: 'Do we need biometric hardware, or can employees clock in via mobile?',
      a: 'Employees can easily check in using their smartphones via selfie Face ID with GPS geofencing. If you already have physical fingerprint or face attendance machines (eSSL, ZKTeco, Matrix, Realtime), you can connect those as well!',
    },
    {
      q: 'How does salary calculation work without discrepancies?',
      a: 'HRDesk connects every single attendance event (present, late-in, half-day, week off, approved comp-off) directly to the payroll engine. It calculates exact payable days, deducts Loss of Pay (LOP), adds overtime, and adjusts loan EMIs in 1 click.',
    },
    {
      q: 'How do employees receive their salary slips on WhatsApp?',
      a: 'At month-end, click "Send Payslips". HRDesk generates individual password-protected PDF salary slips and delivers them directly to each employee’s WhatsApp with real-time delivery confirmation.',
    },
    {
      q: 'How quickly can our organization get started?',
      a: 'In under 60 seconds! Click "Start Free Trial", enter your company name, and your workspace is provisioned immediately with shifts, departments, and 14 days of full access. No credit card required.',
    },
    {
      q: 'Can we manage multiple office, store, or project locations?',
      a: 'Yes. You can add all your branches or job sites, set dedicated GPS boundaries, assign branch managers, and view centralized attendance on a single real-time dashboard.',
    },
  ];

  const industryUseCases = [
    {
      icon: Building2,
      title: 'Offices & Technology Companies',
      desc: 'Seamless hybrid check-ins, multi-tier leave approvals, automated WhatsApp salary slips, and shift rosters.',
      badge: 'Corporate & Tech',
    },
    {
      icon: ShoppingBag,
      title: 'Retail Stores & Showrooms',
      desc: 'Prevent buddy punching across multiple stores with GPS-locked mobile selfie punches and grace period rules.',
      badge: 'Retail & Multi-Store',
    },
    {
      icon: Factory,
      title: 'Manufacturing & Warehouses',
      desc: 'Manage day/night worker shift rotations, overtime hours, biometric machine sync, and instant advance salary EMIs.',
      badge: 'Plants & Logistics',
    },
    {
      icon: HardHat,
      title: 'Construction & Site Teams',
      desc: 'Track on-site worker muster rolls with mobile GPS geofencing, daily attendance sheets, and cash advance tracking.',
      badge: 'Contractors & Sites',
    },
    {
      icon: Stethoscope,
      title: 'Hospitals & Healthcare Clinics',
      desc: 'Handle doctor and nurse rotational duty shifts, emergency comp-offs, and accurate monthly salary disbursements.',
      badge: 'Healthcare & Clinics',
    },
    {
      icon: Globe,
      title: 'Agencies & Service Firms',
      desc: 'Manage client-site teams, remote employee attendance regularizations, and transparent digital expense tracking.',
      badge: 'Agencies & Consulting',
    },
  ];

  const testimonials = [
    {
      quote:
        'HRDesk cut our monthly payroll calculation from 3 days of spreadsheet mess to just 10 minutes. Sending salary slips directly on WhatsApp was a game changer for our 85 employees.',
      author: 'Sunil Agarwal',
      role: 'Managing Director',
      company: 'Agarwal Textiles & Retail (4 Stores)',
      metric: '3 Days → 10 Mins',
      metricLabel: 'Payroll Processing Time',
      avatarBg: 'bg-indigo-600',
    },
    {
      quote:
        'The selfie face punch with location boundary solved our site attendance issues completely. No more buddy punching or disputes over late check-ins.',
      author: 'Pooja Nair',
      role: 'Head of Operations',
      company: 'Nair Engineering & Services',
      metric: '100% Accurate',
      metricLabel: 'Attendance Precision',
      avatarBg: 'bg-emerald-600',
    },
    {
      quote:
        'Setup took literally 1 minute. Our team started punching in from their phones on day one without any training needed. Best software investment we made this year.',
      author: 'Karan Mehra',
      role: 'Co-Founder',
      company: 'Apex Digital Studio',
      metric: '60 Seconds',
      metricLabel: 'Onboarding Time',
      avatarBg: 'bg-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] font-ui selection:bg-[var(--gold-500)] selection:text-[var(--navy-900)]">
      {/* ═══════════════════════════════════════════
          1. STICKY TOP NAVBAR (Rippling/Deel Clean Bar)
      ═══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--surface)]/90 border-b border-[var(--rule)] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-9 h-9 rounded bg-[var(--gold-500)] text-[var(--navy-900)] flex items-center justify-center font-bold shadow-xs">
              <Building2 size={20} />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight text-[var(--ink)]">
                HRDesk<span className="text-[var(--gold-500)]">.</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/20">
                Workforce OS
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[var(--ink-muted)]">
            <a
              href="#interactive-demo"
              className="hover:text-[var(--ink)] transition-colors text-[var(--gold-600)] dark:text-[var(--gold-400)] font-bold flex items-center gap-1"
            >
              <Sparkles size={13} />
              <span>Interactive Studio</span>
            </a>
            <a href="#pipeline" className="hover:text-[var(--ink)] transition-colors">
              How It Works
            </a>
            <a href="#comparison" className="hover:text-[var(--ink)] transition-colors">
              Why HRDesk
            </a>
            <a href="#use-cases" className="hover:text-[var(--ink)] transition-colors">
              Solutions
            </a>
            <a href="#roi-calculator" className="hover:text-[var(--ink)] transition-colors">
              ROI Calculator
            </a>
            <a href="#pricing" className="hover:text-[var(--ink)] transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[var(--ink)] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/sign-in')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--gold-600)] transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
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
          2. HERO SECTION WITH HIGH-IMPACT VALUE PROP & AMBIENT MESH
      ═══════════════════════════════════════════ */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-[var(--rule)]">
        {/* Modern Ambient Mesh Glows (Rippling style) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[750px] h-[360px] bg-[var(--gold-500)]/12 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[420px] h-[260px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-7">
          {/* Live Pulsing Activity Ticker (Deel style) */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] border border-[var(--gold-500)]/25 text-xs font-semibold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>
              ⚡ <strong>{livePunchesCount.toLocaleString()}</strong> Punches verified today across 18 locations • 99.4% On-Time
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--ink)] max-w-4xl mx-auto leading-[1.12]">
            The All-In-One Workforce & Payroll Platform for Modern Companies
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-[var(--ink-muted)] max-w-2xl mx-auto leading-relaxed">
            Eliminate attendance disputes and spreadsheet errors. Employees clock in via mobile selfie Face ID or biometric machines, salaries calculate automatically in 1 click, and password-protected PDF payslips send directly to WhatsApp.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-sm py-3.5 px-8 font-bold flex items-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto justify-center hover:scale-[1.02] transition-transform"
              >
                <span>Go to Your Workspace</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => navigate('/register')}
                className="btn-primary text-sm py-3.5 px-8 font-bold flex items-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto justify-center hover:scale-[1.02] transition-transform"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight size={16} />
              </button>
            )}

            <a
              href="#interactive-demo"
              className="btn-secondary text-sm py-3.5 px-8 font-semibold flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center hover:bg-[var(--surface-sunken)] transition-colors"
            >
              <span>Explore Interactive Studio</span>
              <Sparkles size={15} className="text-[var(--gold-500)]" />
            </a>
          </div>

          {/* Value Badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Instant 60-Second Setup</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Works on Any Smartphone</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>WhatsApp Salary Slips</span>
            </span>
          </div>

          {/* ⭐ HERO INTERACTIVE SCANNER (Hands-On Product Sandbox) */}
          <div className="pt-8 max-w-4xl mx-auto">
            <div className="bg-[var(--surface)] border-2 border-[var(--gold-500)]/40 rounded-[var(--radius-xl)] shadow-2xl p-5 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 items-center text-left relative overflow-hidden">
              <div className="absolute top-3 right-4 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Interactive Sandbox</span>
              </div>

              {/* Left Viewfinder Simulator (5 cols) */}
              <div className="md:col-span-5 bg-[var(--surface-sunken)] rounded-[var(--radius-lg)] border border-[var(--rule)] p-4 text-center space-y-3 relative overflow-hidden">
                {isScanning && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.8)] top-0 animate-bounce transition-all z-20" />
                )}

                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-emerald-500/20 to-[var(--gold-500)]/20 border-2 border-dashed border-emerald-500 flex items-center justify-center relative">
                  <div className="w-16 h-16 rounded-full bg-emerald-600/30 flex items-center justify-center">
                    <Users size={28} className="text-emerald-500" />
                  </div>
                  <span className="absolute -bottom-2 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white shadow-xs">
                    {isScanning ? 'Scanning Face...' : scanSuccess ? 'Verified ✓' : 'Ready'}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">Aarav Sharma</div>
                  <div className="text-[10px] text-[var(--ink-muted)]">Designation: Senior Architect • ID #1042</div>
                </div>

                <button
                  onClick={handleSimulatePunch}
                  disabled={isScanning}
                  className={`w-full py-2 px-3 rounded text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                    isScanning
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isScanning ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Scanning Face & GPS...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={13} />
                      <span>Tap to Test Live Punch</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right Live Punch Telemetry (7 cols) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                  <span className="text-xs font-bold text-[var(--ink)]">Live Punch Telemetry</span>
                  <span className="font-mono text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                    Status: {scanSuccess ? 'Present (On Time)' : 'Awaiting Check-In'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                    <span className="text-[10px] text-[var(--ink-muted)] block">Face AI Match Score</span>
                    <strong className="text-xs font-bold text-emerald-600 font-data">
                      {isScanning ? 'Calculating...' : 'Cosine: 0.948 (94.8%)'}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                    <span className="text-[10px] text-[var(--ink-muted)] block">GPS Geofence Distance</span>
                    <strong className="text-xs font-bold text-[var(--ink)] font-data">
                      12m from Office Center (Allowed &lt; 100m)
                    </strong>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] flex items-center justify-between text-xs">
                  <span className="text-[var(--ink-muted)]">Last Recorded Punch:</span>
                  <strong className="text-emerald-600 font-data">{lastPunchTime}</strong>
                </div>

                <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                  Every verified punch instantly updates the 31-day team muster roll and automatically recalculates payable days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          3. ⭐ HOW IT WORKS: 1-SOURCE PIPELINE (#pipeline) (Rippling style)
      ═══════════════════════════════════════════ */}
      <section id="pipeline" className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Unified Single Source of Truth
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              How Attendance Automatically Powers Payroll
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              No manual exports or Excel formulas. Every stage is connected in a continuous real-time flow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="p-5 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]/60 border border-[var(--rule)] space-y-3 relative">
              <span className="w-7 h-7 rounded-full bg-[var(--gold-500)] text-[var(--navy-900)] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="font-display text-sm font-bold text-[var(--ink)]">Mobile Selfie / Biometric Punch</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Employees clock in with selfie Face ID & GPS radius or hardware biometric machines.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]/60 border border-[var(--rule)] space-y-3 relative">
              <span className="w-7 h-7 rounded-full bg-[var(--gold-500)] text-[var(--navy-900)] font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="font-display text-sm font-bold text-[var(--ink)]">31-Day Muster Calculation</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Automatically logs present days, approved leaves, comp-offs (COHF), and late-in marks.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]/60 border border-[var(--rule)] space-y-3 relative">
              <span className="w-7 h-7 rounded-full bg-[var(--gold-500)] text-[var(--navy-900)] font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="font-display text-sm font-bold text-[var(--ink)]">1-Click Salary Ledger</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Exact gross-to-net payroll computed with automatic LOP and salary advance EMI deductions.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-5 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)]/60 border border-[var(--rule)] space-y-3 relative">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h3 className="font-display text-sm font-bold text-[var(--ink)]">WhatsApp PDF Delivery</h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Instant bulk dispatch of password-protected PDF salary slips straight to employee phones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          4. ⭐ THE OLD WAY VS HRDESK (Deel/Rippling Ledger Comparison)
      ═══════════════════════════════════════════ */}
      <section id="comparison" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Before vs After
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Why Teams Switch from Spreadsheets to HRDesk
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              See how modern automation replaces manual guesswork and salary calculation headaches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* The Old Way */}
            <div className="p-7 rounded-[var(--radius-xl)] bg-[var(--surface)] border-2 border-rose-500/20 shadow-xs space-y-5">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <XCircle size={18} />
                <span>The Traditional Spreadsheet Way</span>
              </div>
              <ul className="space-y-3.5 text-xs text-[var(--ink-muted)]">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span><strong>3 to 4 days</strong> spent manually compiling punch logs from machines and WhatsApp messages.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Frequent employee disputes over late marks, half-days, and forgotten comp-off approvals.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Printing and distributing physical salary slips that get misplaced or leaked.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-bold">✕</span>
                  <span>Buddy punching and proxy check-ins draining thousands of rupees in unverified payroll leakage.</span>
                </li>
              </ul>
            </div>

            {/* The HRDesk Way */}
            <div className="p-7 rounded-[var(--radius-xl)] bg-[var(--surface)] border-2 border-emerald-500/40 shadow-md space-y-5 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>The HRDesk Automated Way</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                  Zero Error
                </span>
              </div>
              <ul className="space-y-3.5 text-xs text-[var(--ink)]">
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>10 minutes</strong> total to run full month payroll directly from verified attendance logs.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Single-source attendance engine automatically syncs comp-offs (COHF) and Loss of Pay (LOP).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>1-Click bulk WhatsApp dispatch of encrypted PDF salary slips directly to phones.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>AI selfie Face ID with GPS perimeter check guarantees 100% genuine presence.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          5. ⭐ INTERACTIVE PRODUCT STUDIO (4 LIVE SIMULATORS)
      ═══════════════════════════════════════════ */}
      <section id="interactive-demo" className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-500)]/15 text-[var(--gold-600)] dark:text-[var(--gold-400)] text-xs font-bold uppercase tracking-wider">
              <Sparkles size={13} />
              <span>Interactive Product Explorer</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Experience the Real Platform in Action
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Select any tab below to test live shift schedules, 31-day team muster roll, salary calculation, and WhatsApp delivery.
            </p>
          </div>

          {/* Studio Container */}
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-xl)] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Left Nav (4 cols) */}
            <div className="lg:col-span-4 p-5 bg-[var(--surface-sunken)]/60 border-b lg:border-b-0 lg:border-r border-[var(--rule)] space-y-2">
              <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider px-2 block mb-3">
                Live Interactive Engines
              </span>

              {[
                {
                  id: 'face' as const,
                  title: 'Selfie Face & GPS Check-In',
                  desc: 'Anti-spoof face recognition and office radius verification.',
                  icon: ScanLine,
                  badge: 'Instant',
                },
                {
                  id: 'shifts' as const,
                  title: 'Shift Rotations & Day/Night Rotas',
                  desc: 'Configure flexible working hours, grace time & overtime.',
                  icon: Sun,
                  badge: 'Flexible',
                },
                {
                  id: 'attendance' as const,
                  title: 'Real-Time Attendance Muster',
                  desc: 'Daily attendance logs, leaves, half-days & week offs.',
                  icon: Clock,
                  badge: 'Zero Disputes',
                },
                {
                  id: 'payroll' as const,
                  title: '1-Click Salary Calculation',
                  desc: 'Automatic LOP deductions, overtime and loan EMIs.',
                  icon: Receipt,
                  badge: 'Instant Math',
                },
                {
                  id: 'whatsapp' as const,
                  title: 'WhatsApp PDF Payslips',
                  desc: 'Direct delivery of encrypted salary slips to phone numbers.',
                  icon: MessageSquare,
                  badge: '1-Click Send',
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
                        <Icon
                          size={16}
                          className={isSelected ? 'text-[var(--gold-500)]' : 'text-[var(--ink-muted)]'}
                        />
                        <span className={`text-xs font-bold ${isSelected ? 'text-[var(--ink)]' : ''}`}>
                          {tab.title}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] text-emerald-600">
                        {tab.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed pl-6">{tab.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Right Mockup Viewport (8 cols) */}
            <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-center bg-[var(--surface)] relative overflow-hidden">
              {/* Tab 1: AI Face & GPS Punch */}
              {activeTab === 'face' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                        <ScanLine size={20} />
                      </div>
                      <div>
                        <h4 className="font-display text-base font-bold text-[var(--ink)]">
                          Mobile Selfie Attendance Check-In
                        </h4>
                        <span className="text-xs text-[var(--ink-muted)]">
                          Instant Facial Recognition • GPS Geofenced Office Area
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>Punch Verified (On Time)</span>
                    </span>
                  </div>

                  {/* Face Camera Simulation Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] border border-[var(--rule)] space-y-3 text-center relative overflow-hidden">
                      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-emerald-500/20 to-[var(--gold-500)]/20 border-2 border-dashed border-emerald-500 flex items-center justify-center relative">
                        <div className="w-16 h-16 rounded-full bg-emerald-600/30 flex items-center justify-center">
                          <Users size={28} className="text-emerald-500" />
                        </div>
                        <span className="absolute -bottom-2 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white shadow-xs">
                          Face Matched ✓
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[var(--ink)]">Rajesh Sharma</div>
                        <div className="text-[11px] text-[var(--ink-muted)]">Employee ID #1042 • Sales Team</div>
                      </div>
                      <div className="p-2 rounded bg-[var(--surface)] text-[10px] text-emerald-600 font-mono border border-emerald-500/20 flex items-center justify-between">
                        <span>Photo Check: Real Live Person</span>
                        <span>Match: 94% ✓</span>
                      </div>
                    </div>

                    {/* Geofence Check */}
                    <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] border border-[var(--rule)] space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                          GPS Location Verification
                        </span>
                        <div className="flex items-center gap-2">
                          <MapPin size={18} className="text-[var(--gold-500)] shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-[var(--ink)]">Main Branch — Mumbai Office</div>
                            <div className="text-[10px] text-[var(--ink-muted)]">Within 15 meters of office perimeter</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                          <span className="text-[var(--ink-muted)]">Punch Time:</span>
                          <strong className="text-[var(--ink)] font-data">09:28 AM (On Time)</strong>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[var(--ink-muted)]">Status:</span>
                          <strong className="text-emerald-600 font-data">Present (Full Day)</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Shift Rotations & Planner */}
              {activeTab === 'shifts' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">
                        Interactive Shift Roster Visualizer
                      </h4>
                      <span className="text-xs text-[var(--ink-muted)]">
                        Select a shift profile to see how grace periods and overtime rules apply
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] text-xs font-bold">
                      <button
                        onClick={() => setActiveShiftType('day')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                          activeShiftType === 'day' ? 'bg-[var(--gold-500)] text-[var(--navy-900)]' : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        Day
                      </button>
                      <button
                        onClick={() => setActiveShiftType('night')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                          activeShiftType === 'night' ? 'bg-[var(--gold-500)] text-[var(--navy-900)]' : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        Night
                      </button>
                      <button
                        onClick={() => setActiveShiftType('rotational')}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                          activeShiftType === 'rotational' ? 'bg-[var(--gold-500)] text-[var(--navy-900)]' : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        Rotational
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] space-y-1">
                      <span className="text-[10px] text-[var(--ink-muted)] block">Shift Hours</span>
                      <strong className="font-data text-sm font-bold text-[var(--ink)]">
                        {activeShiftType === 'day' ? '09:30 AM – 06:30 PM' : activeShiftType === 'night' ? '09:00 PM – 06:00 AM' : 'Custom Weekly Rotas'}
                      </strong>
                    </div>
                    <div className="p-3 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] space-y-1">
                      <span className="text-[10px] text-[var(--ink-muted)] block">Grace Period Buffer</span>
                      <strong className="font-data text-sm font-bold text-emerald-600">
                        15 Mins (Late-in after 09:45)
                      </strong>
                    </div>
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <span className="text-[10px] text-emerald-600 block font-bold">Overtime Multiplier</span>
                      <strong className="font-data text-sm font-bold text-emerald-600">
                        {activeShiftType === 'night' ? '1.5x Hourly Rate' : '1.25x Hourly Rate'}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded bg-[var(--surface-sunken)]/60 border border-[var(--rule)] text-xs text-[var(--ink-muted)] flex items-center justify-between">
                    <span>Shift swap requests can be filed by employees on mobile and approved by branch managers instantly.</span>
                  </div>
                </div>
              )}

              {/* Tab 3: Attendance Muster */}
              {activeTab === 'attendance' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">
                        Monthly Team Attendance Muster Sheet
                      </h4>
                      <span className="text-xs text-[var(--ink-muted)]">
                        Real-time daily records • Auto-calculated payable days
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[var(--gold-600)] font-bold bg-[var(--gold-500)]/10 px-2.5 py-1 rounded">
                      Current Month
                    </span>
                  </div>

                  <div className="border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden text-xs">
                    <div className="bg-[var(--surface-sunken)] p-2.5 font-bold flex items-center justify-between border-b border-[var(--rule)] text-[11px]">
                      <span>Employee Name</span>
                      <div className="flex items-center gap-4">
                        <span>Punches (Days 1–7)</span>
                        <span>Payable Days</span>
                      </div>
                    </div>

                    {[
                      { name: 'Amit Verma', role: 'Sales Executive', p: ['P', 'P', 'P', 'COHF', 'P', 'WO', 'WO'], payable: '29.5 / 31' },
                      { name: 'Sneha Patel', role: 'Store Manager', p: ['P', 'P', 'A', 'P', 'P', 'WO', 'WO'], payable: '28.0 / 31' },
                      { name: 'Karan Mehra', role: 'Technician', p: ['P', 'P', 'P', 'P', 'P', 'WO', 'WO'], payable: '31.0 / 31' },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 flex items-center justify-between border-b border-[var(--rule)]/60 hover:bg-[var(--surface-sunken)]/40 transition-colors"
                      >
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
                    <span>Exact payable days calculated automatically. 0 disputes or manual errors.</span>
                  </div>
                </div>
              )}

              {/* Tab 4: Payroll Ledger */}
              {activeTab === 'payroll' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">
                        1-Click Exact Salary Calculation
                      </h4>
                      <span className="text-xs text-[var(--ink-muted)]">
                        Directly linked to attendance — never overpay or underpay
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Auto-Calculated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                      <span className="text-[10px] text-[var(--ink-muted)] block">Gross Monthly Salary</span>
                      <strong className="text-base font-bold text-[var(--ink)] font-data">{'\u20B9'}35,000</strong>
                    </div>
                    <div className="p-3 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                      <span className="text-[10px] text-rose-600 block">Absence LOP (1.0 Day)</span>
                      <strong className="text-base font-bold text-rose-600 font-data">-{'\u20B9'}1,129</strong>
                    </div>
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-600 font-bold block">Net Payable Salary</span>
                      <strong className="text-base font-bold text-emerald-600 font-data">{'\u20B9'}33,871</strong>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--surface-sunken)]/50 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                      <span className="text-[var(--ink-muted)]">Approved Comp-Off Credit Added:</span>
                      <strong className="text-emerald-600 font-data">+0.5 Day (+{'\u20B9'}565)</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--rule)]">
                      <span className="text-[var(--ink-muted)]">Salary Advance EMI Deducted:</span>
                      <strong className="text-[var(--ink)] font-data">-{'\u20B9'}2,000 (Advance #ADV-102)</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[var(--ink-muted)]">Final Bank Transfer Amount:</span>
                      <strong className="text-emerald-600 font-bold font-data">{'\u20B9'}32,436</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: WhatsApp Payslip Generator */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
                    <div>
                      <h4 className="font-display text-base font-bold text-[var(--ink)]">
                        Interactive WhatsApp Payslip Simulator
                      </h4>
                      <span className="text-xs text-[var(--ink-muted)]">
                        Pick a salary below to generate a real-time WhatsApp delivery preview
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[35000, 50000, 75000].map((sal) => (
                        <button
                          key={sal}
                          onClick={() => handleRegeneratePayslip(sal)}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                            payslipSalary === sal ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-sunken)] text-[var(--ink)]'
                          }`}
                        >
                          {'\u20B9'}{(sal / 1000)}k
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)] border border-[var(--rule)] max-w-md mx-auto space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)] border-b border-[var(--rule)] pb-2">
                      <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-emerald-600" />
                        HRDesk Automated Payroll
                      </span>
                      <span>10:02 AM</span>
                    </div>

                    {isSendingWhatsApp ? (
                      <div className="p-6 text-center text-xs text-[var(--ink-muted)] space-y-2">
                        <RefreshCw size={18} className="animate-spin text-emerald-600 mx-auto" />
                        <span>Compiling encrypted salary slip PDF...</span>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-emerald-600/10 border border-emerald-500/25 space-y-2 text-xs animate-fade-in">
                        <p className="text-[var(--ink)] leading-relaxed">
                          Hello <strong>Pooja</strong>, your salary slip for this month has been processed.
                        </p>
                        <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--rule)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <div>
                              <div className="font-bold text-xs text-[var(--ink)]">Salary_Slip_Pooja.pdf</div>
                              <div className="text-[10px] text-[var(--ink-muted)]">Password: DDMM (Your DOB)</div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold">
                            Download
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-emerald-600 pt-1">
                          <span>Net Transferred: {'\u20B9'}{(payslipSalary - 1800).toLocaleString('en-IN')}</span>
                          <span className="flex items-center gap-0.5">
                            <CheckCheck size={12} /> Delivered
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          6. ⭐ USE CASES: PERFECT FOR ANY INDUSTRY (#use-cases) (Keka/Gusto style)
      ═══════════════════════════════════════════ */}
      <section id="use-cases" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Universal Solution
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Tailored for Every Type of Organization
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              From compact offices and retail outlets to 500-employee multi-location enterprises, HRDesk fits your exact operational workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industryUseCases.map((uc, idx) => {
              const Icon = uc.icon;
              return (
                <div
                  key={idx}
                  className="bg-[var(--surface)] p-6 rounded-[var(--radius-xl)] border border-[var(--rule)] hover:border-[var(--gold-500)]/60 transition-all space-y-3 shadow-xs hover:shadow-md group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--gold-500)]/15 text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                      {uc.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[var(--ink)] group-hover:text-[var(--gold-600)] dark:group-hover:text-[var(--gold-400)] transition-colors">
                    {uc.title}
                  </h3>

                  <p className="text-xs text-[var(--ink-muted)] leading-relaxed">{uc.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          7. ⭐ INTERACTIVE ROI & SAVINGS CALCULATOR (Deel/Gusto style)
      ═══════════════════════════════════════════ */}
      <section id="roi-calculator" className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold">
              <DollarSign size={13} />
              <span>Instant Savings Calculator</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              See How Much Time & Money You Save Monthly
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Move the sliders to match your employee headcount and see how much time and salary leakage HRDesk prevents.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[var(--surface-sunken)]/50 p-6 sm:p-10 rounded-[var(--radius-xl)] border border-[var(--rule)] shadow-sm">
            {/* Left Sliders Controls (6 cols) */}
            <div className="lg:col-span-6 space-y-8">
              {/* Slider 1: Employees */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                    Total Active Employees
                  </label>
                  <span className="text-lg font-bold font-data text-[var(--gold-600)] dark:text-[var(--gold-400)] px-3 py-1 bg-[var(--surface)] rounded border border-[var(--rule)]">
                    {employeeCount} Employees
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(Number(e.target.value))}
                  className="w-full accent-[var(--gold-500)] cursor-pointer h-2 bg-[var(--surface-sunken)] rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                  <span>5 Employees</span>
                  <span>150 Employees</span>
                  <span>300+ Employees</span>
                </div>
              </div>

              {/* Slider 2: Branches */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                    Office / Branch Locations
                  </label>
                  <span className="text-lg font-bold font-data text-emerald-600 px-3 py-1 bg-[var(--surface)] rounded border border-[var(--rule)]">
                    {branchCount} {branchCount === 1 ? 'Location' : 'Locations'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={branchCount}
                  onChange={(e) => setBranchCount(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-[var(--surface-sunken)] rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                  <span>1 Location</span>
                  <span>8 Locations</span>
                  <span>15 Locations</span>
                </div>
              </div>

              <div className="p-4 rounded bg-[var(--surface)] border border-[var(--rule)] text-xs text-[var(--ink-muted)] flex items-center gap-3">
                <Flame size={18} className="text-amber-500 shrink-0" />
                <span>
                  HRDesk eliminates hours spent manually cross-checking attendance registers, leaves, and salary slips.
                </span>
              </div>
            </div>

            {/* Right Live Computed Results (6 cols) */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--rule)] space-y-2">
                <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">Time Saved Every Month</span>
                <div className="font-display text-3xl sm:text-4xl font-bold text-[var(--gold-500)]">
                  ~{roiCalculations.hoursSavedPerMonth} hrs
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">No more manual Excel calculations.</p>
              </div>

              <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--rule)] space-y-2">
                <span className="text-[11px] font-bold text-emerald-600 uppercase">Salary Leakage Saved</span>
                <div className="font-display text-3xl sm:text-4xl font-bold text-emerald-600 font-data">
                  {'\u20B9'}{roiCalculations.leakagePrevented.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">From unrecorded absences & half-days.</p>
              </div>

              <div className="p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--rule)] space-y-2">
                <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase">WhatsApp Salary Slips</span>
                <div className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)] font-data">
                  {roiCalculations.payslipsAutomated} / mo
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">Delivered in 1 click to employee phones.</p>
              </div>

              <div className="p-6 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--gold-500)]/15 to-emerald-500/15 border border-[var(--gold-500)]/30 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[var(--gold-600)] dark:text-[var(--gold-400)] uppercase">
                    Estimated ROI Multiplier
                  </span>
                  <div className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
                    {roiCalculations.roiMultiplier}x
                  </div>
                </div>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-primary text-xs py-2.5 px-3 font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
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
          8. CORE PLATFORM MODULES (Rippling style)
      ═══════════════════════════════════════════ */}
      <section id="modules" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              All-In-One Platform
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Everything Needed to Run Your Workforce
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Manage daily attendance, leaves, loan advances, and salary slips without juggling multiple apps or Excel files.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="bg-[var(--surface)] p-8 rounded-[var(--radius-xl)] border border-[var(--rule)] space-y-5 hover:border-[var(--gold-500)]/60 transition-colors shadow-xs">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--gold-500)]/15 text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                  Attendance
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Mobile Selfie & Biometric Check-In
              </h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Employees can clock in with a quick selfie on their phone or through standard fingerprint/face machines. Location boundaries ensure they only punch when physically at the work site.
              </p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>GPS location radius verification (Geofencing)</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>31-Day team muster roll with late marks & half-days</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Employees can request missed punch regularizations in 1 tap</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-[var(--surface)] p-8 rounded-[var(--radius-xl)] border border-[var(--rule)] space-y-5 hover:border-[var(--gold-500)]/60 transition-colors shadow-xs">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <Receipt size={24} />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                  Salary & WhatsApp
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Automatic Payroll & WhatsApp Payslips
              </h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Click one button to calculate monthly salaries based on real attendance. Automatically deducts unpaid leaves (LOP) and sends password-protected PDF salary slips straight to employee WhatsApp.
              </p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Exact payable days & Loss of Pay (LOP) auto-calculation</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Bulk 1-click WhatsApp PDF salary slip dispatch</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Salary advance & loan EMI tracker with monthly deduction</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-[var(--surface)] p-8 rounded-[var(--radius-xl)] border border-[var(--rule)] space-y-5 hover:border-[var(--gold-500)]/60 transition-colors shadow-xs">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-blue-500/15 text-blue-600 flex items-center justify-center">
                  <Building2 size={24} />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                  Locations & Shifts
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Multi-Branch & Shift Management
              </h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Manage multiple shop branches, project sites, or offices under one account. Set individual work shift hours, night shifts, and local holiday calendars for each branch.
              </p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Separate office and branch locations with GPS radius</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Day, evening, and night rotational shift schedules</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Branch manager access permissions (Only see own branch)</span>
                </li>
              </ul>
            </div>

            {/* Feature 4 */}
            <div className="bg-[var(--surface)] p-8 rounded-[var(--radius-xl)] border border-[var(--rule)] space-y-5 hover:border-[var(--gold-500)]/60 transition-colors shadow-xs">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-purple-500/15 text-purple-600 flex items-center justify-center">
                  <Calendar size={24} />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-[var(--surface-sunken)] text-[var(--ink-muted)] border border-[var(--rule)]">
                  Leaves & Directory
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--ink)]">
                Leave Approvals & Employee Records
              </h3>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                Track employee leave quotas (paid leaves, sick leaves, comp-offs), approve leave requests with one click, and store employee Aadhaar, PAN, and appointment letters securely.
              </p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>1-Tap leave applications and manager approval flow</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Digital employee directory and encrypted document vault</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--ink)]">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Auto-generated experience and relieving letters</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          9. CUSTOMER STORIES & REAL METRICS (Gusto style)
      ═══════════════════════════════════════════ */}
      <section className="py-20 border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Customer Experiences
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Loved by Business Leaders & Teams
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              See why companies across retail, services, and construction choose HRDesk to manage their workforce.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-[var(--radius-xl)] bg-[var(--surface-sunken)]/50 border border-[var(--rule)] flex flex-col justify-between space-y-5 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-xs text-[var(--ink)] leading-relaxed italic">"{t.quote}"</p>
                </div>

                <div className="pt-4 border-t border-[var(--rule)] space-y-3">
                  <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--rule)] flex items-center justify-between text-xs">
                    <span className="text-[10px] text-[var(--ink-muted)] font-medium">{t.metricLabel}</span>
                    <strong className="font-bold text-emerald-600 font-data">{t.metric}</strong>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full ${t.avatarBg} text-white font-bold flex items-center justify-center text-xs shrink-0`}
                    >
                      {t.author.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[var(--ink)]">{t.author}</div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        {t.role} • {t.company}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          10. PRICING (#pricing) (Keka/Deel style)
      ═══════════════════════════════════════════ */}
      <section id="pricing" className="py-20 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold-600)] dark:text-[var(--gold-400)]">
              Simple, Affordable Pricing
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--ink)]">
              Choose the Plan That Fits Your Team
            </h2>
            <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
              Every plan includes a 14-day free trial. No credit card required to start.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
            {plans.map((p, idx) => {
              const price = billingCycle === 'yearly' ? Math.round(p.priceYearly / 12) : p.priceMonthly;
              return (
                <div
                  key={idx}
                  className={`bg-[var(--surface)] rounded-[var(--radius-xl)] border p-7 flex flex-col justify-between transition-all relative ${
                    p.popular
                      ? 'border-[var(--gold-500)] shadow-xl ring-2 ring-[var(--gold-500)]/20'
                      : 'border-[var(--rule)] hover:border-[var(--rule-bold)] shadow-xs'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-[var(--gold-500)] text-[var(--navy-900)] text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      {p.badge ?? 'Most Popular'}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--ink)]">{p.name}</h3>
                      <p className="text-[11px] text-[var(--ink-muted)] mt-1 min-h-[32px]">{p.tagline}</p>
                    </div>

                    <div className="py-3 border-y border-[var(--rule)]">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-bold text-[var(--ink)]">
                          {price === 0 ? 'Free' : `\u20B9${price.toLocaleString('en-IN')}`}
                        </span>
                        {price > 0 && <span className="text-[10px] text-[var(--ink-muted)]">/ mo</span>}
                      </div>
                      {billingCycle === 'yearly' && p.priceYearly > 0 && (
                        <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                          Billed annually at {'\u20B9'}{p.priceYearly.toLocaleString('en-IN')}/yr
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--ink)]">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-[var(--gold-500)]" />
                        <span>
                          <strong>{p.maxEmployees}</strong> Active Employees
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-[var(--gold-500)]" />
                        <span>
                          <strong>{p.maxBranches}</strong> {p.maxBranches === 1 ? 'Location' : 'Locations'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block">
                        Included Features
                      </span>
                      <ul className="space-y-2 text-xs">
                        {p.features.map((feat: string, fi: number) => (
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
                    className={`w-full py-3 px-4 text-xs font-bold rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-8 ${
                      p.popular
                        ? 'btn-primary shadow-sm'
                        : 'border border-[var(--rule)] bg-[var(--surface-sunken)] hover:bg-[var(--surface)] text-[var(--ink)]'
                    }`}
                  >
                    <span>Start 14-Day Free Trial</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          11. FREQUENTLY ASKED QUESTIONS (#faq)
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
                className="bg-[var(--surface-sunken)]/40 border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden transition-colors shadow-xs"
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
          12. FINAL CALL TO ACTION BANNER
      ═══════════════════════════════════════════ */}
      <section className="py-20 text-center relative overflow-hidden bg-[var(--surface-sunken)]/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-[var(--ink)] tracking-tight">
            Ready to Automate Your Workforce Attendance & Payroll?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-muted)] max-w-xl mx-auto leading-relaxed">
            Create your company workspace in 60 seconds and experience automatic attendance, salary calculations, and WhatsApp payslips.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                navigate('/register');
              }}
              className="btn-primary text-sm py-4 px-9 font-bold flex items-center gap-2 cursor-pointer shadow-xl mx-auto hover:scale-[1.02] transition-transform"
            >
              <span>Create Your Free Account Now</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          13. CLEAN FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="bg-[var(--surface)] border-t border-[var(--rule)] py-12 text-xs text-[var(--ink-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[var(--gold-500)] text-[var(--navy-900)] flex items-center justify-center font-bold text-xs">
              <Building2 size={15} />
            </div>
            <span className="font-display font-bold text-sm text-[var(--ink)]">HRDesk Platform</span>
            <span className="text-[10px] text-[var(--ink-muted)] ml-2">
              © {new Date().getFullYear()} All rights reserved.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium">
            <a href="#interactive-demo" className="hover:text-[var(--ink)]">
              Interactive Studio
            </a>
            <a href="#pipeline" className="hover:text-[var(--ink)]">
              How It Works
            </a>
            <a href="#comparison" className="hover:text-[var(--ink)]">
              Why HRDesk
            </a>
            <a href="#use-cases" className="hover:text-[var(--ink)]">
              Solutions
            </a>
            <a href="#roi-calculator" className="hover:text-[var(--ink)]">
              ROI Calculator
            </a>
            <a href="#modules" className="hover:text-[var(--ink)]">
              Features
            </a>
            <a href="#pricing" className="hover:text-[var(--ink)]">
              Pricing
            </a>
            <Link to="/auth/sign-in" className="hover:text-[var(--ink)]">
              Sign In
            </Link>
            <Link to="/register" className="hover:text-[var(--ink)] font-semibold text-[var(--gold-600)]">
              Start Free Trial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
