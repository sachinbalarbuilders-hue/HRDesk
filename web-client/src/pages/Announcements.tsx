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
  Lock,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { ArchiveToggle, type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';

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
  imagePath: string | null;
  videoPath: string | null;
}

const CATEGORIES = ['All', 'General', 'Notice', 'Holiday', 'Event', 'Policy', 'Urgent'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export const AnnouncementsPage: React.FC = () => {
  const { isAdmin, hasPermission } = useAuth();

  const canView = isAdmin || hasPermission('Announcements.View') || hasPermission('Announcements.Manage');
  const canCreate = isAdmin || hasPermission('Announcements.Create') || hasPermission('Announcements.Manage');
  const canEdit = isAdmin || hasPermission('Announcements.Edit') || hasPermission('Announcements.Manage');
  const canDelete = isAdmin || hasPermission('Announcements.Delete') || hasPermission('Announcements.Manage');

  const { currentOrganization, currentBranch, branches } = useOrganization();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');

  // Media Lightbox State
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<'image' | 'video'>('image');

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/announcements', {
        params: {
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          search: search || undefined,
          branchId: currentBranch?.id || undefined,
          archiveStatus: archiveFilter,
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
  }, [currentOrganization?.id, currentBranch?.id, selectedCategory, search, archiveFilter]);

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
    setImageFile(null);
    setVideoFile(null);
    setImagePreview(null);
    setVideoPreview(null);
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
    setImageFile(null);
    setVideoFile(null);
    setImagePreview((item as any).imagePath || null);
    setVideoPreview((item as any).videoPath || null);
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
        // Upload media if new files selected
        if (imageFile) {
          const fd = new FormData();
          fd.append('file', imageFile);
          await apiClient.post(`/announcements/${editingItem.id}/media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        if (videoFile) {
          const fd = new FormData();
          fd.append('file', videoFile);
          await apiClient.post(`/announcements/${editingItem.id}/media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      } else {
        const res = await apiClient.post('/announcements', payload);
        const newId = res.data.id;
        // Upload media after creation
        if (imageFile && newId) {
          const fd = new FormData();
          fd.append('file', imageFile);
          await apiClient.post(`/announcements/${newId}/media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        if (videoFile && newId) {
          const fd = new FormData();
          fd.append('file', videoFile);
          await apiClient.post(`/announcements/${newId}/media`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      }

      setModalOpen(false);
      fetchAnnouncements();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const announcementArchive = useArchiveActions({
    endpoint: '/announcements',
    label: 'Announcement',
    permissionKey: 'Announcements.Delete',
    onDone: fetchAnnouncements,
  });

  const handleTogglePin = async (id: number) => {
    try {
      await apiClient.patch(`/announcements/${id}/pin`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const getBadgeVariant = (cat: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    switch (cat?.toLowerCase()) {
      case 'holiday':
        return 'success';
      case 'urgent':
        return 'danger';
      case 'policy':
        return 'warning';
      case 'event':
        return 'info';
      default:
        return 'default';
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader
          title="Company Bulletin & Announcements"
          description="Broadcast notices, holiday calendars, policy changes, and events to staff across offices."
        />
        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-12 text-center max-w-md mx-auto my-12 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Lock size={22} />
          </div>
          <h3 className="font-display font-semibold text-base text-[var(--ink)]">Access Restricted</h3>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            You do not have permission to view company announcements and bulletins. Please contact your administrator if you require access.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Company Bulletin & Announcements"
        description="Broadcast notices, holiday calendars, policy changes, and events to staff across offices."
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary flex items-center gap-2 text-sm px-4 py-2 cursor-pointer shadow-sm"
            >
              <Plus size={16} />
              <span>Post Announcement</span>
            </button>
          ) : undefined
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ArchiveToggle value={archiveFilter} onChange={setArchiveFilter} />
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
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
      </div>

      {loading ? (
        <PageSkeleton />
      ) : announcements.length === 0 ? (
        <EmptyState
          title="No announcements found"
          description={canCreate ? "Click the button below to publish company notices, events, and holiday reminders." : "No published announcements currently available."}
          icon={<Megaphone size={36} className="text-[var(--text-muted)]" />}
          action={
            canCreate
              ? {
                  label: 'Post Announcement',
                  onClick: openCreateModal,
                  icon: <Plus size={14} />,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {announcements.map((item) => {
            const rowActions: RowAction[] = [];
            if (canEdit && !isRowArchived(item)) {
              rowActions.push({ label: 'Edit', icon: <Edit2 size={14} />, onClick: () => openEditModal(item) });
            }
            if (canDelete) {
              rowActions.push(
                ...announcementArchive.rowActions({ id: item.id, name: item.title, isArchived: isRowArchived(item) })
              );
            }

            return (
              <Card
                key={item.id}
                padding="none"
                className={`flex flex-col justify-between overflow-hidden transition-all hover:shadow-md bg-[var(--surface)] border-[var(--border)] ${
                  item.isPinned ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30' : ''
                }`}
              >
                <div className="p-5 flex-1 flex flex-col">
                  {/* Card Header (Badges + Actions) */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getBadgeVariant(item.category)} size="sm">
                        {item.category}
                      </Badge>
                      {item.isPinned && (
                        <Badge variant="warning" size="sm" className="flex items-center gap-1">
                          <Pin size={10} className="fill-current" /> Pinned
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 -mt-1 -mr-2">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(item.id)}
                          title={item.isPinned ? 'Unpin' : 'Pin to top'}
                          className={`p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors ${
                            item.isPinned ? 'text-amber-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Pin size={14} className={item.isPinned ? 'fill-amber-500' : ''} />
                        </button>
                      )}
                      {rowActions.length > 0 && <RowActionMenu actions={rowActions} />}
                    </div>
                  </div>

                  {/* Media Preview */}
                  {item.imagePath && (
                    <img
                      src={item.imagePath}
                      alt=""
                      className="w-full h-40 object-cover rounded-[var(--radius-md)] mb-4 border border-[var(--border)] cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => { setLightboxUrl(item.imagePath); setLightboxType('image'); }}
                    />
                  )}
                  {item.videoPath && !item.imagePath && (
                    <div
                      className="relative w-full h-40 rounded-[var(--radius-md)] mb-4 border border-[var(--border)] cursor-pointer overflow-hidden group"
                      onClick={() => { setLightboxUrl(item.videoPath); setLightboxType('video'); }}
                    >
                      <video src={item.videoPath} className="w-full h-full object-cover" muted preload="metadata" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-105">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--accent)] ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text Content */}
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line line-clamp-3 mb-2">
                    {item.message}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3.5 bg-[var(--surface-secondary)] border-t border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar size={13} className="text-[var(--text-secondary)]" />
                    <span>{item.startDate}{item.endDate ? ` → ${item.endDate}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building size={13} className="text-[var(--text-secondary)]" />
                    <span className="truncate max-w-[120px] font-medium">{item.branchName}</span>
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

            {/* Media Upload */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Attach Image (optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setImageFile(f);
                    if (f) setImagePreview(URL.createObjectURL(f));
                  }}
                  className="w-full text-xs text-[var(--text-secondary)] file:mr-2 file:px-3 file:py-1.5 file:rounded-[var(--radius-md)] file:border-0 file:text-xs file:font-medium file:bg-[var(--accent-light)] file:text-[var(--accent)] file:cursor-pointer cursor-pointer"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-2 h-20 rounded-[var(--radius-md)] object-cover border border-[var(--border)]" />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Attach Video (optional)
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setVideoFile(f);
                    if (f) setVideoPreview(URL.createObjectURL(f));
                  }}
                  className="w-full text-xs text-[var(--text-secondary)] file:mr-2 file:px-3 file:py-1.5 file:rounded-[var(--radius-md)] file:border-0 file:text-xs file:font-medium file:bg-[var(--accent-light)] file:text-[var(--accent)] file:cursor-pointer cursor-pointer"
                />
                {videoPreview && (
                  <video src={videoPreview} className="mt-2 h-20 rounded-[var(--radius-md)] border border-[var(--border)]" controls muted />
                )}
              </div>
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

      {/* Media Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer text-xl font-bold"
            onClick={() => setLightboxUrl(null)}
          >
            &times;
          </button>
          {lightboxType === 'image' ? (
            <img
              src={lightboxUrl}
              alt=""
              className="max-w-[90vw] max-h-[85vh] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={lightboxUrl}
              className="max-w-[90vw] max-h-[85vh] rounded-lg"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {announcementArchive.dialog}
    </PageContainer>
  );
};
