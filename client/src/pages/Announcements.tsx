import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/CompanyContext';
import {
  Megaphone,
  Plus,
  Pin,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  Building,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/PageSkeleton';

interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  category: string;
  priority: string;
  startDate: string;
  endDate: string | null;
  isPinned: boolean;
  isActive: boolean;
  branchId: number | null;
  branchName: string;
  createdAt: string;
  createdByName: string;
}

const CATEGORIES = ['All', 'General', 'Notice', 'Holiday', 'Event', 'Policy', 'Urgent'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export const AnnouncementsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { currentOrganization, currentBranch, branches } = useOrganization();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState('Normal');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [targetBranchId, setTargetBranchId] = useState<number | ''>('');
  const [isPinned, setIsPinned] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/announcements', {
        params: {
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          search: search || undefined,
          branchId: currentBranch?.id || undefined,
        },
      });
      setAnnouncements(res.data.items || []);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [currentOrganization?.id, currentBranch?.id, selectedCategory, search]);

  const openCreateModal = () => {
    setEditingItem(null);
    setTitle('');
    setMessage('');
    setCategory('General');
    setPriority('Normal');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setTargetBranchId(currentBranch?.id ? Number(currentBranch.id) : (branches[0]?.id ? Number(branches[0].id) : ''));
    setIsPinned(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: AnnouncementItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setMessage(item.message);
    setCategory(item.category || 'General');
    setPriority(item.priority || 'Normal');
    setStartDate(item.startDate || new Date().toISOString().split('T')[0]);
    setEndDate(item.endDate || '');
    setTargetBranchId(item.branchId ? Number(item.branchId) : (currentBranch?.id ? Number(currentBranch.id) : (branches[0]?.id ? Number(branches[0].id) : '')));
    setIsPinned(item.isPinned);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!message.trim()) {
      setFormError('Message is required.');
      return;
    }

    const selectedBranch = targetBranchId ? Number(targetBranchId) : (currentBranch?.id || branches[0]?.id);
    if (!selectedBranch) {
      setFormError('Please select a valid branch.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        title: title.trim(),
        message: message.trim(),
        category,
        priority,
        startDate,
        endDate: endDate || null,
        branchId: selectedBranch,
        isPinned,
        isActive: true,
      };

      if (editingItem) {
        await apiClient.put(`/announcements/${editingItem.id}`, payload);
      } else {
        await apiClient.post('/announcements', payload);
      }

      setModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await apiClient.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete announcement', err);
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      await apiClient.patch(`/announcements/${id}/pin`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'holiday':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'urgent':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'policy':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'event':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Company Bulletin & Announcements"
        description="Broadcast notices, holiday calendars, policy changes, and events to staff across offices."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 cursor-pointer shadow-sm"
          >
            <Plus size={16} />
            <span>Post Announcement</span>
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : announcements.length === 0 ? (
        <EmptyState
          title="No announcements found"
          description="Click the button below to publish company notices, events, and holiday reminders."
          icon={<Megaphone size={36} className="text-[var(--text-muted)]" />}
          action={{
            label: 'Post Announcement',
            onClick: openCreateModal,
            icon: <Plus size={14} />,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {announcements.map((item) => {
            const isHoliday = item.category?.toLowerCase() === 'holiday';
            const isUrgent = item.category?.toLowerCase() === 'urgent' || item.priority?.toLowerCase() === 'urgent';

            return (
              <Card
                key={item.id}
                padding="none"
                className={`flex flex-col justify-between overflow-hidden transition-all hover:shadow-md ${
                  item.isPinned ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30' : ''
                }`}
              >
                <div>
                  {/* Card Header Strip */}
                  <div
                    className={`px-4 py-3 flex items-center justify-between border-b border-[var(--border)] ${
                      isHoliday
                        ? 'bg-emerald-950/20'
                        : isUrgent
                        ? 'bg-rose-950/20'
                        : 'bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(item.category)}`}>
                        {item.category}
                      </span>
                      {item.isPinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <Pin size={10} className="fill-amber-300" /> Pinned
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(item.id)}
                        title={item.isPinned ? 'Unpin' : 'Pin to top'}
                        className={`p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-hover)] cursor-pointer ${
                          item.isPinned ? 'text-amber-400' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Edit"
                        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        title="Delete"
                        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--danger)] hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    <h3 className="text-base font-bold text-[var(--text-primary)] mb-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line line-clamp-4">
                      {item.message}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-[var(--surface-secondary)] border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>{item.startDate}{item.endDate ? ` → ${item.endDate}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Building size={12} />
                    <span className="truncate max-w-[120px]">{item.branchName}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Announcement' : 'Post New Announcement'}
      >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-[var(--radius-md)] bg-rose-500/15 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} /> {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Announcement Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Office Holiday Notice - Diwali 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Target Office Branch *
              </label>
              <select
                required
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Message Body *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Write the full announcement details..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPinnedCheck"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--accent)] cursor-pointer"
              />
              <label htmlFor="isPinnedCheck" className="text-xs text-[var(--text-primary)] cursor-pointer">
                Pin this announcement to top of dashboard
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-secondary px-4 py-2 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary px-4 py-2 text-sm cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>{editingItem ? 'Save Changes' : 'Publish Announcement'}</span>
              </button>
            </div>
          </form>
        </Modal>
    </PageContainer>
  );
};
