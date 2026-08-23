import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/CompanyContext';
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CreditCard,
  Sparkles,
  Info,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../api/client';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
  timeAgo: string;
}

export const NotificationDropdown: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { currentOrganization } = useOrganization();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await apiClient.get('/notifications', {
        params: {
          unreadOnly: false,
          page: 1,
          pageSize: 30,
        },
      });
      if (res.data) {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to fetch in-app notifications:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Fetch immediately on mount, on auth login, and on organization change
  useEffect(() => {
    fetchNotifications(true);
  }, [user, token, currentOrganization?.id, fetchNotifications]);

  // Polling every 20 seconds for live badge updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Listen to custom refresh events across app
  useEffect(() => {
    const onRefresh = () => fetchNotifications(true);
    window.addEventListener('notification-refresh', onRefresh);
    return () => window.removeEventListener('notification-refresh', onRefresh);
  }, [fetchNotifications]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications(true);
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await apiClient.post(`/notifications/${id}/read`);
      if (res.data && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      setMarkingAll(true);
      await apiClient.post('/notifications/read-all');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      fetchNotifications(true);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await apiClient.delete(`/notifications/${id}`);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }
    if (item.linkUrl) {
      setIsOpen(false);
      navigate(item.linkUrl);
    }
  };

  const renderIcon = (type: string, severity: string) => {
    switch (type.toLowerCase()) {
      case 'leave':
        return <Calendar size={15} className="text-amber-500" />;
      case 'security':
        return severity === 'danger' ? (
          <ShieldAlert size={15} className="text-rose-500" />
        ) : (
          <ShieldCheck size={15} className="text-emerald-500" />
        );
      case 'attendance':
      case 'regularization':
        return <Clock size={15} className="text-blue-500" />;
      case 'loan':
        return <CreditCard size={15} className="text-purple-500" />;
      case 'celebration':
        return <Sparkles size={15} className="text-pink-500" />;
      default:
        return <Info size={15} className="text-[var(--gold-500)]" />;
    }
  };

  const displayedNotifications = notifications.filter((n) =>
    activeTab === 'unread' ? !n.isRead : true
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative p-2 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors ${
          isOpen ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)]' : ''
        }`}
        title={unreadCount > 0 ? `${unreadCount} Unread Notifications` : 'Notifications & Alerts'}
      >
        <Bell size={19} className={unreadCount > 0 ? 'text-[var(--gold-500)]' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold font-mono text-white bg-rose-600 rounded-full ring-2 ring-[var(--surface)] shadow-md animate-pulse pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-md)] shadow-2xl z-50 overflow-hidden flex flex-col font-ui animate-fade-in text-xs">
          {/* Header */}
          <div className="p-3.5 border-b border-[var(--rule)] bg-[var(--surface-sunken)]/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm text-[var(--ink)]">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 font-mono text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="px-2 py-1 rounded hover:bg-[var(--paper)] text-[11px] font-semibold text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center gap-1 cursor-pointer transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} />
                  <span>Mark read</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchNotifications()}
                className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                title="Refresh"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-3.5 pt-2 pb-1.5 bg-[var(--surface-sunken)]/20 border-b border-[var(--rule)] flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-[3px] font-semibold transition-colors cursor-pointer text-[11px] ${
                activeTab === 'all'
                  ? 'bg-[var(--navy-900)] text-[var(--gold-500)] shadow-2xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`px-2.5 py-1 rounded-[3px] font-semibold transition-colors cursor-pointer text-[11px] ${
                activeTab === 'unread'
                  ? 'bg-[var(--navy-900)] text-[var(--gold-500)] shadow-2xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications Scroll List */}
          <div className="divide-y divide-[var(--rule)] max-h-[360px] overflow-y-auto min-h-[160px]">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-[var(--ink-muted)] flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-[var(--gold-500)]" />
                <span>Loading notifications...</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-[var(--ink-muted)] space-y-1">
                <Bell size={24} className="mx-auto opacity-30 text-[var(--ink-muted)] mb-2" />
                <p className="font-semibold text-xs text-[var(--ink)]">All caught up!</p>
                <p className="text-[11px]">
                  {activeTab === 'unread'
                    ? 'No unread notifications pending.'
                    : 'No notifications recorded yet.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 transition-colors flex items-start justify-between gap-3 text-xs cursor-pointer group ${
                    !item.isRead
                      ? 'bg-[var(--gold-500)]/5 hover:bg-[var(--gold-500)]/10'
                      : 'hover:bg-[var(--surface-sunken)]/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--paper)] border border-[var(--rule)] shrink-0 shadow-2xs mt-0.5">
                      {renderIcon(item.type, item.severity)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold truncate ${!item.isRead ? 'text-[var(--ink)] font-bold' : 'text-[var(--ink-muted)]'}`}>
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-[var(--ink-muted)] mt-0.5 line-clamp-2 leading-relaxed font-ui">
                        {item.message}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--ink-muted)] font-mono">
                        <span>{item.timeAgo}</span>
                        {item.linkUrl && (
                          <span className="inline-flex items-center gap-0.5 text-[var(--gold-600)] dark:text-[var(--gold-400)] font-semibold">
                            View <ExternalLink size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-emerald-600 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-[var(--rule)] bg-[var(--surface-sunken)]/40 text-center">
            <span className="text-[10px] font-mono text-[var(--ink-muted)]">
              Real-time company & security alerts
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
