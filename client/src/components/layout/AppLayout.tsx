import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
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
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentOrganization, organizations, switchOrganization } = useOrganization();
  const { showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  const navigation = [
    {
      group: 'Overview',
      items: [
        {
          name: 'Dashboard',
          href: '/',
          icon: LayoutDashboard,
          show: true,
        },
        {
          name: 'Employees',
          href: '/employees',
          icon: Users,
          show: isAdmin || hasPermission('Employees.View'),
        },
      ],
    },
    {
      group: 'Talent & Hiring',
      items: [
        {
          name: 'Recruitment ATS',
          href: '/recruitment',
          icon: UserPlus,
          show: true,
        },
      ],
    },
    {
      group: 'Time & Attendance',
      items: [
        {
          name: 'Attendance',
          href: '/attendance',
          icon: CalendarCheck,
          show: isAdmin || hasPermission('Attendance.View') || hasPermission('Attendance.MonthlySheet'),
        },
        {
          name: 'Regularization',
          href: '/regularizations',
          icon: Clock,
          show: isAdmin || hasPermission('Attendance.View') || hasPermission('Attendance.Regularize'),
        },
        {
          name: 'Shift Roster',
          href: '/shifts',
          icon: Layers,
          show: isAdmin || hasPermission('Attendance.View'),
        },
        {
          name: 'Leaves',
          href: '/leaves',
          icon: CalendarOff,
          show: isAdmin || hasPermission('Leaves.View'),
        },
        {
          name: 'Holidays',
          href: '/holidays',
          icon: Sparkles,
          show: true,
        },
      ],
    },
    {
      group: 'Finance & Advances',
      items: [
        {
          name: 'Monthly Payroll',
          href: '/payroll',
          icon: Banknote,
          show: isAdmin || hasPermission('Payroll.View') || hasPermission('Payroll.Process'),
        },
        {
          name: 'Loans & Advances',
          href: '/loans',
          icon: Banknote,
          show: isAdmin || hasPermission('Payroll.View'),
        },
      ],
    },
    {
      group: 'Administration & Governance',
      items: [
        {
          name: 'Settings & Masters',
          href: '/settings',
          icon: SettingsIcon,
          show: isAdmin,
        },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOrgSelect = (orgId: string, orgName: string) => {
    switchOrganization(orgId);
    setOrgDropdownOpen(false);
    showSuccess('Organisation Switched', `Active organisation: ${orgName}`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)] font-ui">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Fixed Navy Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--navy-900)] text-white border-r border-[var(--navy-700)] transition-all duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 w-60' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[68px]' : 'lg:w-60'}`}
      >
        {/* Sidebar Brand Header */}
        <div
          className={`flex items-center h-14 border-b border-[var(--navy-700)] bg-[var(--navy-900)] ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {collapsed ? (
            /* Collapsed Brand Icon */
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center w-8 h-8 rounded-[4px] bg-[var(--gold-500)] text-[var(--navy-900)] font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
              title="Expand Sidebar"
            >
              <Building2 size={16} />
            </button>
          ) : (
            /* Expanded Brand */
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex items-center justify-center w-7 h-7 rounded-[4px] bg-[var(--gold-500)] text-[var(--navy-900)] font-bold text-xs flex-shrink-0">
                  <Building2 size={15} />
                </div>
                <div>
                  <span className="font-bold text-sm tracking-tight text-white block leading-none">
                    HRDesk
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--gold-500)] font-data block mt-0.5">
                    HRMS Portal
                  </span>
                </div>
              </div>

              <button
                onClick={() => setCollapsed(true)}
                className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-[var(--navy-700)] transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </>
          )}

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className={`flex-1 py-4 space-y-4 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
          {navigation.map((group) => {
            const visible = group.items.filter((i) => i.show);
            if (visible.length === 0) return null;

            return (
              <div key={group.group} className="space-y-1">
                {!collapsed && (
                  <p className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-ui truncate">
                    {group.group}
                  </p>
                )}

                {visible.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== '/' && location.pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center rounded-[4px] text-xs transition-colors relative ${
                        collapsed
                          ? 'justify-center p-2.5'
                          : 'gap-2.5 px-2.5 py-2'
                      } ${
                        isActive
                          ? 'bg-[var(--navy-700)] text-white font-semibold'
                          : 'text-slate-300 hover:bg-[var(--navy-700)]/60 hover:text-white'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      {/* Active gold tick indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[var(--gold-500)] rounded-r" />
                      )}

                      <Icon
                        size={16}
                        className={`flex-shrink-0 ${
                          isActive ? 'text-[var(--gold-500)]' : 'text-slate-400'
                        }`}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Operator Profile Footer */}
        <div className={`border-t border-[var(--navy-700)] bg-[var(--navy-900)] ${collapsed ? 'p-2' : 'p-3'}`}>
          <div
            className={`flex items-center gap-2.5 ${
              collapsed ? 'justify-center' : 'p-1'
            }`}
          >
            <div className="w-7 h-7 rounded-[4px] bg-[var(--navy-700)] border border-[var(--gold-500)]/40 text-[var(--gold-500)] font-semibold font-data flex items-center justify-center text-xs flex-shrink-0">
              {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.fullName || user?.username}
                </p>
                <p className="text-[10px] text-slate-400 font-data truncate">
                  {user?.roleName || user?.role}
                </p>
              </div>
            )}

            {!collapsed && (
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-[var(--gold-500)] p-1 rounded hover:bg-[var(--navy-700)] transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>

          {collapsed && (
            <div className="mt-2 pt-2 border-t border-[var(--navy-700)] flex justify-center">
              <button
                onClick={() => setCollapsed(false)}
                className="text-slate-400 hover:text-[var(--gold-500)] p-1 transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar with Single Organisation Switcher */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--rule)] bg-[var(--surface)] z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1 rounded text-[var(--ink-muted)] hover:bg-[var(--paper)] cursor-pointer"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--ink)]">HRDesk</span>
              <span className="text-[var(--ink-muted)]">/</span>
              <span className="text-[var(--ink-muted)] font-ui capitalize">
                {location.pathname.replace('/', '') || 'Dashboard'}
              </span>
            </div>

            {/* --- Global Single Organisation Switcher --- */}
            <div className="relative">
              <button
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] hover:border-[var(--gold-500)] text-xs font-semibold text-[var(--ink)] transition-colors cursor-pointer"
                title="Switch Active Organisation"
              >
                <Building2 size={13} className="text-[var(--gold-500)] flex-shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-[220px]">
                  {currentOrganization?.name || 'Select Organisation'}
                </span>
                <ChevronDown size={12} className="text-[var(--ink-muted)]" />
              </button>

              {/* Organisation Dropdown Popover */}
              {orgDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setOrgDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-72 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-xl z-40 py-1.5 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider border-b border-[var(--rule)] mb-1">
                      Active Organisation
                    </div>

                    {organizations.map((org) => {
                      const isSelected = String(currentOrganization?.id) === String(org.id);
                      return (
                        <button
                          key={org.id}
                          onClick={() => handleOrgSelect(String(org.id), org.name)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-[var(--paper)] transition-colors cursor-pointer ${
                            isSelected ? 'font-bold text-[var(--gold-500)] bg-[var(--gold-100)]/30' : 'text-[var(--ink)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Building2 size={13} className={isSelected ? 'text-[var(--gold-500)]' : 'text-[var(--ink-muted)]'} />
                            <div className="truncate">
                              <p className="truncate leading-none">{org.name}</p>
                              {org.code && <p className="text-[10px] font-data text-[var(--ink-muted)] mt-0.5">{org.code}</p>}
                            </div>
                          </div>

                          {isSelected && <Check size={13} className="text-[var(--gold-500)] flex-shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Biometric Machine Status */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-[11px] font-data text-[var(--ok-600)]">
              <span className="status-dot-ok" />
              <span>Biometrics Connected</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-[4px] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] border border-[var(--rule)] transition-colors cursor-pointer"
              title="Toggle Theme (Dark / Light)"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Current Date Time */}
            <div className="hidden lg:flex items-center gap-1 text-[11px] font-data text-[var(--ink-muted)]">
              <Clock size={12} />
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1280px] mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
