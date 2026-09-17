import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../ui/Avatar';
import { NotificationDropdown } from './NotificationDropdown';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarOff,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sun,
  Moon,
  Settings as SettingsIcon,
  ChevronDown,
  Check,
  Layers,
  Sparkles,
  Banknote,
  UserPlus,
  MapPin,
  Search,
  Bell,
  Camera,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  Megaphone,
  Gift,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentOrganization, organizations, currentBranch, branches, switchOrganization, switchBranch } = useOrganization();
  const { showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const navigation = [
    {
      group: 'Overview',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
        { name: 'Announcements', href: '/announcements', icon: Megaphone, show: isAdmin || hasPermission('Announcements.View') || hasPermission('Announcements.Manage') },
        { name: 'Employees', href: '/employees', icon: Users, show: isAdmin || hasPermission('Employees.View') },
      ],
    },
    {
      group: 'Talent',
      items: [
        { name: 'Recruitment', href: '/recruitment', icon: UserPlus, show: true },
      ],
    },
    {
      group: 'Time & Attendance',
      items: [
        { name: 'Attendance', href: '/attendance', icon: CalendarCheck, show: isAdmin || hasPermission('Attendance.View') },
        { name: 'Regularization', href: '/regularizations', icon: Clock, show: isAdmin || hasPermission('Regularizations.View') || hasPermission('Attendance.Regularize') || hasPermission('Regularizations.Approve') },
        {
          name: 'Shifts',
          href: '/shifts',
          icon: Layers,
          show:
            isAdmin ||
            hasPermission('Shifts.Roster.View') ||
            hasPermission('Shifts.Roster.Assign') ||
            hasPermission('Shifts.Requests.View') ||
            hasPermission('Shifts.Requests.Apply') ||
            hasPermission('Shifts.Requests.Approve') ||
            hasPermission('Shifts.Requests.Delete') ||
            hasPermission('Shifts.View') ||
            hasPermission('Shifts.Manage') ||
            hasPermission('Attendance.Roster'),
        },
        { name: 'Leaves', href: '/leaves', icon: CalendarOff, show: isAdmin || hasPermission('Leaves.View') },
        { name: 'Comp-Off', href: '/compoff', icon: Gift, show: isAdmin || hasPermission('CompOff.View') || hasPermission('CompOff.Apply') || hasPermission('CompOff.Approve') },
        { name: 'Holidays', href: '/holidays', icon: Sparkles, show: isAdmin || hasPermission('Holidays.View') || hasPermission('Holidays.Manage') },
      ],
    },
    {
      group: 'Finance',
      items: [
        { name: 'Payroll', href: '/payroll', icon: Banknote, show: isAdmin || hasPermission('Payroll.View') || hasPermission('Payroll.Process') },
        { name: 'Loans', href: '/loans', icon: PiggyBank, show: isAdmin || hasPermission('Payroll.View') },
      ],
    },
    {
      group: 'Settings',
      items: [
        {
          name: 'Settings',
          href: '/settings',
          icon: SettingsIcon,
          show:
            isAdmin ||
            hasPermission('Masters.Organizations.View') ||
            hasPermission('Masters.Departments.View') ||
            hasPermission('Masters.Designations.View') ||
            hasPermission('Leaves.Types.View') ||
            hasPermission('Shifts.View') ||
            hasPermission('System.Settings.View') ||
            hasPermission('System.Roles.View') ||
            hasPermission('System.Logs.View') ||
            hasPermission('System.Settings') ||
            hasPermission('System.Roles') ||
            hasPermission('System.Devices'),
        },
        { name: 'Scanner', href: '/scanner', icon: Camera, show: true },
      ],
    },
    {
      group: 'Platform',
      items: [
        { name: 'Platform Admin', href: '/ops_console', icon: ShieldCheck, show: user?.isPlatformUser === true },
      ],
    },
  ];

  const handleLogout = () => { logout(); navigate('/auth/sign-in'); };

  const handleOrgSelect = (orgId: string, orgName: string) => {
    switchOrganization(orgId);
    setOrgDropdownOpen(false);
    showSuccess('Workspace Switched', `Active: ${orgName}`);
  };

  const handleBranchSelect = (branchId: string | null, branchName: string) => {
    switchBranch(branchId);
    setBranchDropdownOpen(false);
    showSuccess('Branch Switched', `Active: ${branchName}`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)]">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ═══════════════════════════════════════════
          SIDEBAR
          ═══════════════════════════════════════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}`}
        style={{ transition: 'width 200ms ease, transform 200ms ease' }}
      >
        {/* Brand */}
        <div className={`flex items-center h-[64px] border-b border-[var(--sidebar-border)] ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="w-8 h-8 rounded-md bg-[var(--surface-secondary)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer border border-[var(--border)] shadow-xs hover:bg-[var(--surface)] transition-colors" title="Expand">
              <Layers size={16} className="text-[var(--accent)]" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-[var(--surface-secondary)] border border-[var(--border)] shadow-xs flex items-center justify-center flex-shrink-0">
                  <Layers size={16} className="text-[var(--accent)]" />
                </div>
                <div>
                  <span className=" font-semibold text-sm text-[var(--text-primary)] tracking-tight block leading-tight">HRDesk</span>
                  <span className="text-xs font-normal text-[var(--text-muted)] font-medium">People Platform</span>
                </div>
              </div>
              <button onClick={() => setCollapsed(true)} className="hidden lg:flex w-6 h-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors">
                <ChevronLeft size={14} />
              </button>
            </>
          )}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-5 space-y-6 overflow-y-auto ${collapsed ? 'px-3' : 'px-4'}`}>
          {navigation.map((group) => {
            const visible = group.items.filter((i) => i.show);
            if (visible.length === 0) return null;
            return (
              <div key={group.group} className="space-y-1">
                {!collapsed && (
                  <p className="px-2 mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    {group.group}
                  </p>
                )}
                {visible.map((item) => {
                  const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`relative flex items-center rounded-lg text-sm transition-colors ${
                        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                      } ${
                        isActive
                          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)] font-normal'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      {isActive && !collapsed && (
                        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-md bg-[var(--accent)]" />
                      )}
                      <Icon size={16} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--sidebar-text)]'} strokeWidth={isActive ? 2.5 : 2} />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className={`border-t border-[var(--sidebar-border)] ${collapsed ? 'p-3' : 'p-4'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <Avatar name={user?.fullName || user?.username || 'User'} size="sm" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.fullName || user?.username}</p>
                <p className="text-xs font-normal text-[var(--text-secondary)] truncate">{user?.roleName || user?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} className="text-[var(--text-muted)] hover:text-[var(--danger)] p-1.5 rounded-md hover:bg-[var(--danger-light)] cursor-pointer transition-colors" title="Sign Out">
                <LogOut size={15} />
              </button>
            )}
          </div>
          {collapsed && (
            <div className="mt-3 pt-3 border-t border-[var(--sidebar-border)] flex justify-center">
              <button onClick={() => setCollapsed(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer transition-colors" title="Expand">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-[64px] flex items-center justify-between px-6 lg:px-8 border-b border-[var(--border)] bg-[var(--surface-header)] z-30 flex-shrink-0 relative">
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile menu trigger */}
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] cursor-pointer">
              <Menu size={20} />
            </button>

            {/* Subtle Search */}
            <div className="relative hidden sm:flex items-center w-full max-w-md group">
              <Search size={15} className="absolute left-0 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none group-focus-within:text-[var(--accent)] transition-colors" />
              <input
                type="text"
                placeholder="Search employees, pages or actions..."
                className="w-full bg-transparent border-none py-2 pl-7 pr-12 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <kbd className="absolute right-0 text-xs font-semibold text-[var(--text-muted)] border border-[var(--border-strong)] bg-[var(--surface-secondary)] px-1.5 py-0.5 rounded shadow-xs">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Org Switcher */}
            <div className="relative">
              <button
                onClick={() => { setOrgDropdownOpen(!orgDropdownOpen); setBranchDropdownOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent)] text-sm font-normal text-[var(--text-primary)] cursor-pointer"
              >
                <Building2 size={14} className="text-[var(--accent)]" />
                <span className="truncate max-w-[120px] hidden sm:inline">{currentOrganization?.name || 'Select Org'}</span>
                <ChevronDown size={12} className="text-[var(--text-muted)]" />
              </button>
              {orgDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setOrgDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] shadow-[var(--shadow-lg)] z-40 py-1 animate-slide-down">
                    <div className="px-3 py-2 text-xs uppercase font-semibold text-[var(--text-muted)] tracking-wider">Organizations</div>
                    {organizations.map((org) => {
                      const isSelected = String(currentOrganization?.id) === String(org.id);
                      return (
                        <button key={org.id} onClick={() => handleOrgSelect(String(org.id), org.name)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between text-sm hover:bg-[var(--surface-hover)] cursor-pointer ${isSelected ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)] font-normal'}`}>
                          <span className="truncate">{org.name}</span>
                          {isSelected && <Check size={14} className="text-[var(--accent)]" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Branch Switcher */}
            {branches.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setBranchDropdownOpen(!branchDropdownOpen); setOrgDropdownOpen(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-strong)] hover:border-[var(--accent)] text-sm font-normal text-[var(--text-primary)] cursor-pointer"
                >
                  <MapPin size={13} className="text-[var(--accent)]" />
                  <span className="truncate max-w-[100px] hidden sm:inline">{currentBranch?.name || 'All'}</span>
                  <ChevronDown size={12} className="text-[var(--text-muted)]" />
                </button>
                {branchDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setBranchDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)] z-40 py-1 animate-slide-down">
                      <div className="px-3 py-2 text-xs font-normal uppercase font-semibold text-[var(--text-muted)] tracking-wider">Branches</div>
                      {branches.map((b) => {
                        const isSelected = String(currentBranch?.id) === String(b.id);
                        return (
                          <button key={b.id} onClick={() => handleBranchSelect(String(b.id), b.name)}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between text-sm hover:bg-[var(--surface-secondary)] cursor-pointer ${isSelected ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'}`}>
                            <span className="truncate">{b.name}</span>
                            {isSelected && <Check size={14} className="text-[var(--accent)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notifications */}
            <NotificationDropdown />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-transform active:scale-95 flex items-center justify-center"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun size={18} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon size={18} className="text-[var(--text-secondary)] transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>

            {/* User Avatar (mobile) */}
            <div className="lg:hidden">
              <Avatar name={user?.fullName || user?.username || 'U'} size="sm" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-5">
          <div className="w-full">
            {localStorage.getItem('hrdesk_suspended') === 'true' && !user?.isPlatformUser && !location.pathname.startsWith('/settings') ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[var(--danger-light)] flex items-center justify-center">
                  <ShieldCheck size={32} className="text-[var(--danger)]" />
                </div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Workspace Suspended</h2>
                <p className="text-sm text-[var(--text-secondary)] max-w-md">
                  Your organization workspace has been suspended. Please renew your subscription or contact support to restore access.
                </p>
                <Link to="/settings/subscription" className="btn-primary px-6 py-2.5 text-sm font-semibold">
                  Go to Subscription & Billing
                </Link>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
