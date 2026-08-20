import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../components/ui/DataTable';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { ArchiveActionButton } from '../components/ui/ArchiveActionButton';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  UserPlus,
  Users,
  Briefcase,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  Phone,
  Mail,
  Plus,
  Trash2,
  Edit2,
  X,
  UserCheck,
  Video,
  MapPin,
} from 'lucide-react';

interface CandidateItem {
  candidateId: number;
  candidateName: string;
  email?: string;
  phone?: string;
  appliedFor: string;
  status: 'Sourced' | 'Screening' | 'Interview' | 'Offered' | 'Hired' | 'Rejected';
  source?: string;
  currentSalary?: number;
  expectedSalary?: number;
  applicationDate?: string;
  notes?: string;
  hasResume: boolean;
  resumeFileName?: string;
  hiredEmployeeId?: number;
  hiredEmployeeName?: string;
  createdAt: string;
}

interface InterviewItem {
  id: number;
  candidateId: number;
  candidateName: string;
  appliedFor: string;
  candidatePhone?: string;
  candidateEmail?: string;
  interviewDateTime: string;
  interviewType: 'In-Person' | 'Video' | 'Phone';
  round: string;
  interviewerName: string;
  interviewerPhone?: string;
  location?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
  result?: 'Pass' | 'Fail' | 'Hold';
  feedback?: string;
  createdAt: string;
}

const STAGES = [
  { id: 'Sourced', label: 'Sourced', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  { id: 'Screening', label: 'Screening', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  { id: 'Interview', label: 'Interview', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  { id: 'Offered', label: 'Offer Extended', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200' },
  { id: 'Hired', label: 'Hired & Onboarded', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  { id: 'Rejected', label: 'Archived / Rejected', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
] as const;

export const Recruitment: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();

  const [activeTab, setActiveTab] = useState<'candidates' | 'interviews' | 'openings'>('candidates');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');

  // Overview Metrics
  const [overview, setOverview] = useState<any>({
    totalCandidates: 0,
    pipeline: { sourced: 0, screening: 0, interview: 0, offered: 0, hired: 0, rejected: 0 },
    interviewsThisWeek: 0,
    upcomingInterviewsCount: 0,
    positions: [],
  });

  // Candidates State
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateStageFilter, setCandidateStageFilter] = useState('');
  const [candidatePositionFilter, setCandidatePositionFilter] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatePageSize, setCandidatePageSize] = useState(15);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [totalCandidatePages, setTotalCandidatePages] = useState(1);

  // Interviews State
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [interviewSearch, setInterviewSearch] = useState('');
  const [interviewStatusFilter, setInterviewStatusFilter] = useState('');
  const [interviewPage, setInterviewPage] = useState(1);
  const [interviewPageSize, setInterviewPageSize] = useState(15);

  // Lookups (Departments & Designations)
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // Modals & Drawers
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [hireModalOpen, setHireModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<InterviewItem | null>(null);
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);
  const [drawerTimeline, setDrawerTimeline] = useState<any[]>([]);

  // Candidate Create Form
  const [candidateForm, setCandidateForm] = useState({
    candidateName: '',
    email: '',
    phone: '',
    appliedFor: '',
    source: 'Direct Portal',
    currentSalary: '',
    expectedSalary: '',
    notes: '',
    resumeBase64: '',
    resumeFileName: '',
    resumeContentType: '',
  });

  // Interview Schedule Form
  const [interviewForm, setInterviewForm] = useState({
    candidateId: 0,
    interviewDateTime: '',
    interviewType: 'In-Person',
    round: 'Round 1',
    interviewerName: '',
    interviewerPhone: '',
    location: '',
  });

  // Interview Feedback Form
  const [feedbackForm, setFeedbackForm] = useState({
    status: 'Completed',
    result: 'Pass',
    feedback: '',
  });

  // Hire Form
  const [hireForm, setHireForm] = useState({
    candidateId: 0,
    candidateName: '',
    employeeId: '',
    departmentId: '',
    designationId: '',
    reportingManagerId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    probationDays: 90,
    weekoff: 'Sunday',
  });

  // =========================================================================
  // DATA FETCHING
  // =========================================================================
  const fetchOverview = async () => {
    try {
      const res = await apiClient.get('/recruitment/overview');
      if (res.data) setOverview(res.data);
    } catch (err) {
      console.error('Failed to load recruitment overview', err);
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await apiClient.get('/recruitment/candidates', {
        params: {
          search: candidateSearch || undefined,
          status: candidateStageFilter || undefined,
          position: candidatePositionFilter || undefined,
          page: candidatePage,
          pageSize: candidatePageSize,
        },
      });
      if (res.data) {
        setCandidates(res.data.items || []);
        setTotalCandidates(res.data.totalCount || 0);
        setTotalCandidatePages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch candidates', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const fetchInterviews = async () => {
    try {
      setLoadingInterviews(true);
      const res = await apiClient.get('/recruitment/interviews', {
        params: {
          status: interviewStatusFilter || undefined,
        },
      });
      if (res.data) setInterviews(res.data || []);
    } catch (err) {
      console.error('Failed to fetch interviews', err);
    } finally {
      setLoadingInterviews(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const res = await apiClient.get('/masters/overview');
      if (res.data) {
        if (res.data.departments) setDepartments(res.data.departments);
        if (res.data.designations) setDesignations(res.data.designations);
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchLookups();
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (activeTab === 'candidates') fetchCandidates();
    if (activeTab === 'interviews') fetchInterviews();
  }, [activeTab, candidateSearch, candidateStageFilter, candidatePositionFilter, candidatePage, candidatePageSize, interviewStatusFilter, currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    const handleReload = () => {
      fetchOverview();
      fetchLookups();
      if (activeTab === 'candidates') fetchCandidates();
      if (activeTab === 'interviews') fetchInterviews();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [activeTab]);

  // =========================================================================
  // ACTIONS & HANDLERS
  // =========================================================================
  const handleOpenCandidateDrawer = async (c: CandidateItem) => {
    setSelectedCandidate(c);
    setCandidateDrawerOpen(true);
    try {
      const res = await apiClient.get(`/recruitment/candidates/${c.candidateId}`);
      if (res.data) {
        setDrawerTimeline(res.data.interviews || []);
      }
    } catch (err) {
      console.error('Failed to load timeline', err);
    }
  };

  const handleStageChange = async (candidateId: number, newStage: string) => {
    try {
      await apiClient.patch(`/recruitment/candidates/${candidateId}/status`, { status: newStage });
      showSuccess('Stage Updated', `Candidate moved to ${newStage}.`);
      fetchCandidates();
      fetchOverview();
      if (selectedCandidate && selectedCandidate.candidateId === candidateId) {
        setSelectedCandidate({ ...selectedCandidate, status: newStage as any });
      }
    } catch (err: any) {
      showError('Stage Update Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Maximum resume file size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCandidateForm({
        ...candidateForm,
        resumeBase64: base64,
        resumeFileName: file.name,
        resumeContentType: file.type || 'application/pdf',
      });
      showSuccess('Resume Attached', `${file.name} ready for upload.`);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateForm.candidateName.trim() || !candidateForm.appliedFor.trim()) {
      showError('Validation Error', 'Candidate name and position applied for are required.');
      return;
    }

    try {
      await apiClient.post('/recruitment/candidates', {
        candidateName: candidateForm.candidateName,
        email: candidateForm.email || null,
        phone: candidateForm.phone || null,
        appliedFor: candidateForm.appliedFor,
        source: candidateForm.source,
        currentSalary: candidateForm.currentSalary ? parseFloat(candidateForm.currentSalary) : null,
        expectedSalary: candidateForm.expectedSalary ? parseFloat(candidateForm.expectedSalary) : null,
        notes: candidateForm.notes || null,
        resumeBase64: candidateForm.resumeBase64 || null,
        resumeFileName: candidateForm.resumeFileName || null,
        resumeContentType: candidateForm.resumeContentType || null,
      });

      showSuccess('Candidate Sourced', `${candidateForm.candidateName} added to recruitment pipeline.`);
      setCandidateModalOpen(false);
      setCandidateForm({
        candidateName: '',
        email: '',
        phone: '',
        appliedFor: '',
        source: 'Direct Portal',
        currentSalary: '',
        expectedSalary: '',
        notes: '',
        resumeBase64: '',
        resumeFileName: '',
        resumeContentType: '',
      });
      fetchCandidates();
      fetchOverview();
    } catch (err: any) {
      showError('Failed to Create Candidate', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenScheduleModal = (c: CandidateItem) => {
    setSelectedCandidate(c);
    setInterviewForm({
      candidateId: c.candidateId,
      interviewDateTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      interviewType: 'In-Person',
      round: 'Round 1 (Technical)',
      interviewerName: '',
      interviewerPhone: '',
      location: 'Head Office Conference Room / Google Meet',
    });
    setScheduleModalOpen(true);
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewForm.interviewerName.trim() || !interviewForm.interviewDateTime) {
      showError('Validation Error', 'Interviewer name and date/time are required.');
      return;
    }

    try {
      await apiClient.post('/recruitment/interviews', interviewForm);
      showSuccess('Interview Scheduled', `Interview scheduled for ${selectedCandidate?.candidateName}.`);
      setScheduleModalOpen(false);
      fetchInterviews();
      fetchOverview();
      fetchCandidates();
    } catch (err: any) {
      showError('Scheduling Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenFeedbackModal = (i: InterviewItem) => {
    setSelectedInterview(i);
    setFeedbackForm({
      status: 'Completed',
      result: i.result || 'Pass',
      feedback: i.feedback || '',
    });
    setFeedbackModalOpen(true);
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterview) return;

    try {
      await apiClient.put(`/recruitment/interviews/${selectedInterview.id}`, feedbackForm);
      showSuccess('Feedback Saved', `Evaluation outcome recorded.`);
      setFeedbackModalOpen(false);
      fetchInterviews();
      fetchOverview();
    } catch (err: any) {
      showError('Feedback Save Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenHireModal = (c: CandidateItem) => {
    setSelectedCandidate(c);
    setHireForm({
      candidateId: c.candidateId,
      candidateName: c.candidateName,
      employeeId: '',
      departmentId: '',
      designationId: '',
      reportingManagerId: '',
      joiningDate: new Date().toISOString().split('T')[0],
      probationDays: 90,
      weekoff: 'Sunday',
    });
    setHireModalOpen(true);
  };

  const handleExecuteHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    try {
      const res = await apiClient.post(`/recruitment/candidates/${selectedCandidate.candidateId}/hire`, {
        employeeId: hireForm.employeeId ? parseInt(hireForm.employeeId) : null,
        departmentId: hireForm.departmentId ? parseInt(hireForm.departmentId) : null,
        designationId: hireForm.designationId ? parseInt(hireForm.designationId) : null,
        joiningDate: hireForm.joiningDate,
        probationDays: hireForm.probationDays,
        weekoff: hireForm.weekoff,
      });

      showSuccess('Hired & Onboarded', res.data?.message || 'Candidate converted to active employee!');
      setHireModalOpen(false);
      fetchCandidates();
      fetchOverview();
    } catch (err: any) {
      showError('Hiring Failed', err.response?.data?.message || 'Could not complete onboarding.');
    }
  };

  const handleDeleteCandidate = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this candidate application?')) return;
    try {
      await apiClient.delete(`/recruitment/candidates/${id}`);
      showSuccess('Candidate Removed', 'Candidate application removed from pipeline.');
      fetchCandidates();
      fetchOverview();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleDownloadResume = (candidateId: number) => {
    window.open(`/api/recruitment/candidates/${candidateId}/resume`, '_blank');
  };

  // =========================================================================
  // EXPORT HANDLERS
  // =========================================================================
  const handleExportCandidates = () => {
    exportToCSV('HRDesk_Recruitment_Candidates', candidates, [
      { key: 'candidateId', label: 'Candidate ID' },
      { key: 'candidateName', label: 'Candidate Name' },
      { key: 'appliedFor', label: 'Position Applied' },
      { key: 'status', label: 'Pipeline Stage' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'source', label: 'Source' },
      { key: 'currentSalary', label: 'Current CTC' },
      { key: 'expectedSalary', label: 'Expected CTC' },
      { key: 'applicationDate', label: 'Application Date' },
      { key: 'hiredEmployeeName', label: 'Hired As Employee' },
      { key: 'notes', label: 'Notes' },
    ]);
    showSuccess('Export Complete', 'Candidates directory downloaded.');
  };

  const handleExportInterviews = () => {
    exportToCSV('HRDesk_Interview_Schedules', interviews, [
      { key: 'id', label: 'Interview #' },
      { key: 'candidateName', label: 'Candidate Name' },
      { key: 'appliedFor', label: 'Position' },
      { key: 'interviewDateTime', label: 'Date & Time' },
      { key: 'round', label: 'Round' },
      { key: 'interviewType', label: 'Mode' },
      { key: 'interviewerName', label: 'Interviewer' },
      { key: 'status', label: 'Status' },
      { key: 'result', label: 'Result' },
      { key: 'feedback', label: 'Feedback' },
    ]);
    showSuccess('Export Complete', 'Interview schedules downloaded.');
  };

  // =========================================================================
  // REUSABLE COLUMN DEFINITIONS — NOT MISSING A SINGLE COLUMN
  // =========================================================================

  // 1. Candidates Table Columns
  const candidateColumns: ColumnDef<CandidateItem>[] = [
    {
      key: 'candidateId',
      header: '#',
      width: '45px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (c) => `#${c.candidateId}`,
    },
    {
      key: 'candidateName',
      header: 'Candidate Name',
      render: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center font-bold text-[10px] shrink-0">
            {c.candidateName.charAt(0)}
          </div>
          <div>
            <button
              onClick={() => handleOpenCandidateDrawer(c)}
              className="font-semibold text-xs text-[var(--ink)] hover:text-[var(--gold-500)] text-left cursor-pointer transition-colors block"
            >
              {c.candidateName}
            </button>
            <span className="text-[10px] text-[var(--ink-muted)] font-data block">
              Applied: {c.applicationDate || new Date(c.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'appliedFor',
      header: 'Position Applied',
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <Briefcase size={12} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{c.appliedFor}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Pipeline Stage',
      render: (c) => {
        const stage = STAGES.find(s => s.id === c.status) || STAGES[0];
        return (
          <select
            value={c.status}
            onChange={(e) => handleStageChange(c.candidateId, e.target.value)}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border border-transparent focus:outline-none cursor-pointer ${stage.color}`}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'contact',
      header: 'Contact Info (Phone / Email)',
      render: (c) => (
        <div className="space-y-0.5 text-xs text-[var(--ink)]">
          {c.phone && (
            <div className="flex items-center gap-1 text-[11px] font-data text-[var(--ink)]">
              <Phone size={11} className="text-[var(--ink-muted)]" />
              <span>{c.phone}</span>
            </div>
          )}
          {c.email && (
            <div className="flex items-center gap-1 text-[11px] font-data text-[var(--ink-muted)]">
              <Mail size={11} className="text-[var(--ink-muted)]" />
              <span className="truncate max-w-[140px]">{c.email}</span>
            </div>
          )}
          {!c.phone && !c.email && <span className="text-[var(--ink-muted)]">—</span>}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      className: 'text-xs font-data text-[var(--ink-muted)]',
      render: (c) => c.source || 'Direct',
    },
    {
      key: 'salary',
      header: 'CTC (Current / Expected)',
      render: (c) => (
        <div className="text-[11px] font-data">
          <span className="text-[var(--ink)] font-semibold">
            {c.expectedSalary ? `₹${c.expectedSalary.toLocaleString()}` : '—'}
          </span>
          {c.currentSalary && (
            <span className="text-[var(--ink-muted)] block text-[10px]">
              Curr: ₹{c.currentSalary.toLocaleString()}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'resume',
      header: 'Resume',
      align: 'center',
      render: (c) =>
        c.hasResume ? (
          <button
            onClick={() => handleDownloadResume(c.candidateId)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold cursor-pointer hover:bg-indigo-100 transition-colors"
            title="Download Attached Resume"
          >
            <Download size={11} />
            <span>PDF</span>
          </button>
        ) : (
          <span className="text-[10px] text-[var(--ink-muted)]">No File</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleOpenScheduleModal(c)}
            className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-amber-600 cursor-pointer transition-colors"
            title="Schedule Interview Round"
          >
            <Calendar size={13} />
          </button>

          {c.status !== 'Hired' && (
            <button
              onClick={() => handleOpenHireModal(c)}
              className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-emerald-600 cursor-pointer transition-colors"
              title="1-Click Onboard & Hire Employee"
            >
              <UserCheck size={13} />
            </button>
          )}

          <button
            onClick={() => handleOpenCandidateDrawer(c)}
            className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-[var(--gold-500)] cursor-pointer transition-colors"
            title="View Full Profile & Timeline"
          >
            <Eye size={13} />
          </button>

          <ArchiveActionButton
            isArchived={c.status === 'Rejected'}
            onArchive={() => handleStageChange(c.candidateId, 'Rejected')}
            onRestore={() => handleStageChange(c.candidateId, 'Sourced')}
            itemName={c.candidateName}
          />
          <button
            onClick={() => handleDeleteCandidate(c.candidateId)}
            className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors"
            title="Archive / Delete Application"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  // 2. Interview Schedule Table Columns
  const interviewColumns: ColumnDef<InterviewItem>[] = [
    {
      key: 'id',
      header: '#',
      width: '45px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (i) => `#${i.id}`,
    },
    {
      key: 'candidateName',
      header: 'Candidate',
      render: (i) => (
        <div>
          <span className="font-semibold text-xs text-[var(--ink)] block">{i.candidateName}</span>
          <span className="text-[10px] text-[var(--ink-muted)] font-data block">{i.appliedFor}</span>
        </div>
      ),
    },
    {
      key: 'dateTime',
      header: 'Interview Date & Time',
      render: (i) => (
        <div className="font-data text-xs">
          <span className="font-semibold text-[var(--ink)] block">
            {new Date(i.interviewDateTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)] font-data">
            {new Date(i.interviewDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      key: 'round',
      header: 'Round',
      render: (i) => (
        <span className="inline-block px-2 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-data text-[10px] font-bold text-[var(--ink)]">
          {i.round}
        </span>
      ),
    },
    {
      key: 'mode',
      header: 'Mode / Type',
      render: (i) => (
        <div className="flex items-center gap-1 text-[11px] text-[var(--ink)]">
          {i.interviewType === 'Video' ? (
            <Video size={12} className="text-blue-600" />
          ) : i.interviewType === 'Phone' ? (
            <Phone size={12} className="text-emerald-600" />
          ) : (
            <MapPin size={12} className="text-amber-600" />
          )}
          <span>{i.interviewType}</span>
        </div>
      ),
    },
    {
      key: 'interviewer',
      header: 'Interviewer',
      className: 'text-xs font-medium text-[var(--ink)]',
      render: (i) => (
        <div>
          <span>{i.interviewerName}</span>
          {i.interviewerPhone && <span className="text-[10px] text-[var(--ink-muted)] block font-data">{i.interviewerPhone}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => {
        const isPast = new Date(i.interviewDateTime) < new Date();
        const badgeColor =
          i.status === 'Completed'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
            : i.status === 'Cancelled'
            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
            : isPast
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';

        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
            {i.status}
          </span>
        );
      },
    },
    {
      key: 'result',
      header: 'Evaluation Result',
      render: (i) =>
        i.result === 'Pass' ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
            <CheckCircle2 size={12} /> Pass
          </span>
        ) : i.result === 'Fail' ? (
          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px]">
            <XCircle size={12} /> Reject
          </span>
        ) : i.result === 'Hold' ? (
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
            <AlertCircle size={12} /> On Hold
          </span>
        ) : (
          <span className="text-[11px] text-[var(--ink-muted)]">Pending Feedback</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleOpenFeedbackModal(i)}
            className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-emerald-600 cursor-pointer transition-colors"
            title="Log Interview Feedback & Result"
          >
            <Edit2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  // Filtered lists for Kanban
  const filteredKanbanCandidates = candidates.filter((c) => {
    const s = candidateSearch.trim().toLowerCase();
    const matchSearch = !s || c.candidateName.toLowerCase().includes(s) || c.appliedFor.toLowerCase().includes(s);
    const matchPos = !candidatePositionFilter || c.appliedFor === candidatePositionFilter;
    return matchSearch && matchPos;
  });

  return (
    <PageContainer className="font-ui">
      <PageHeader title="Recruitment" description="Track candidates and hiring pipeline" />

      {/* 2. Top Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider block font-ui">
            Total Pipeline
          </span>
          <span className="font-data font-bold text-xl text-[var(--ink)] block mt-0.5">
            {overview.totalCandidates}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)]">All applicants</span>
        </div>

        <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider block font-ui">
            Screening
          </span>
          <span className="font-data font-bold text-xl text-blue-700 dark:text-blue-300 block mt-0.5">
            {overview.pipeline?.screening || 0}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)]">Resume review</span>
        </div>

        <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block font-ui">
            In Interviews
          </span>
          <span className="font-data font-bold text-xl text-amber-700 dark:text-amber-300 block mt-0.5">
            {overview.pipeline?.interview || 0}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)]">{overview.upcomingInterviewsCount} scheduled</span>
        </div>

        <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider block font-ui">
            Offers Extended
          </span>
          <span className="font-data font-bold text-xl text-purple-700 dark:text-purple-300 block mt-0.5">
            {overview.pipeline?.offered || 0}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)]">Pending acceptance</span>
        </div>

        <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block font-ui">
            Hired & Onboarded
          </span>
          <span className="font-data font-bold text-xl text-emerald-700 dark:text-emerald-300 block mt-0.5">
            {overview.pipeline?.hired || 0}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)]">Converted to staff</span>
        </div>

        <div className="p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <span className="text-[10px] uppercase font-bold text-[var(--gold-500)] tracking-wider block font-ui">
            Active Openings
          </span>
          <span className="font-data font-bold text-xl text-[var(--ink)] block mt-0.5">
            {overview.positions?.length || 0}
          </span>
          <span className="text-[10px] text-[var(--ink-muted)]">Job roles</span>
        </div>
      </div>

      {/* 3. Navigation Tabs & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-[var(--rule)] pb-2">
        <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-[4px] border border-[var(--rule)] overflow-x-auto">
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
              activeTab === 'candidates'
                ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Users size={14} />
            <span>Candidate Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('interviews')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
              activeTab === 'interviews'
                ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Calendar size={14} />
            <span>Interview Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('openings')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
              activeTab === 'openings'
                ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Briefcase size={14} />
            <span>Job Positions & Openings</span>
          </button>
        </div>

        {activeTab === 'candidates' && (
          <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-[4px] border border-[var(--rule)] self-end sm:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-medium rounded-[2px] transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-[var(--navy-900)] text-white' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              Ledger Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 text-xs font-medium rounded-[2px] transition-colors cursor-pointer ${
                viewMode === 'kanban' ? 'bg-[var(--navy-900)] text-white' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              Kanban Board
            </button>
          </div>
        )}
      </div>

      {/* 4. Tab 1: Candidates Pipeline */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={candidateSearch}
            onSearchChange={(v) => { setCandidateSearch(v); setCandidatePage(1); }}
            searchPlaceholder="Search candidates by name, email, phone, or position..."
            filters={[
              {
                id: 'status',
                ariaLabel: 'Stage Filter',
                value: candidateStageFilter,
                onChange: (v) => { setCandidateStageFilter(v); setCandidatePage(1); },
                options: [
                  { value: '', label: 'All Pipeline Stages' },
                  ...STAGES.map(s => ({ value: s.id, label: s.label })),
                ],
              },
              {
                id: 'position',
                ariaLabel: 'Position Filter',
                value: candidatePositionFilter,
                onChange: (v) => { setCandidatePositionFilter(v); setCandidatePage(1); },
                options: [
                  { value: '', label: 'All Positions' },
                  ...overview.positions.map((p: any) => ({ value: p.position, label: p.position })),
                ],
              },
            ]}
            onExport={handleExportCandidates}
            exportLabel="Export CSV"
            onImport={() => setImportModalOpen(true)}
            importLabel="Import CSV"
            primaryAction={{
              label: 'Add Candidate',
              icon: <Plus size={14} />,
              onClick: () => setCandidateModalOpen(true),
            }}
          />

          {viewMode === 'table' ? (
            <DataTable
              columns={candidateColumns}
              data={candidates}
              loading={loadingCandidates}
              emptyMessage="No candidate applications found matching the selected criteria."
              pagination={{
                page: candidatePage,
                pageSize: candidatePageSize,
                totalCount: totalCandidates,
                totalPages: totalCandidatePages,
                onPageChange: setCandidatePage,
                onPageSizeChange: (s) => { setCandidatePageSize(s); setCandidatePage(1); },
              }}
            />
          ) : (
            /* Kanban View */
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 items-start overflow-x-auto pb-4">
              {STAGES.map((stage) => {
                const stageCandidates = filteredKanbanCandidates.filter(c => c.status === stage.id);
                return (
                  <div
                    key={stage.id}
                    className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-3 space-y-2.5 min-w-[220px]"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                      <span className="font-semibold text-xs text-[var(--ink)]">{stage.label}</span>
                      <span className="text-[10px] font-bold font-data px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink)]">
                        {stageCandidates.length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                      {stageCandidates.map((c) => (
                        <div
                          key={c.candidateId}
                          onClick={() => handleOpenCandidateDrawer(c)}
                          className="p-2.5 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] hover:border-[var(--gold-500)]/60 cursor-pointer space-y-1.5 transition-all shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-xs text-[var(--ink)] line-clamp-1">{c.candidateName}</span>
                            <span className="text-[9px] font-data text-[var(--ink-muted)] shrink-0">#{c.candidateId}</span>
                          </div>

                          <div className="text-[11px] text-[var(--gold-500)] font-medium flex items-center gap-1">
                            <Briefcase size={11} />
                            <span className="line-clamp-1">{c.appliedFor}</span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[var(--ink-muted)] pt-1 border-t border-[var(--rule)] font-data">
                            <span>{c.expectedSalary ? `₹${c.expectedSalary.toLocaleString()}` : c.source}</span>
                            {c.hasResume && <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Resume</span>}
                          </div>
                        </div>
                      ))}

                      {stageCandidates.length === 0 && (
                        <div className="py-6 text-center text-[11px] text-[var(--ink-muted)] italic">
                          No candidates
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Interview Schedules */}
      {activeTab === 'interviews' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={interviewSearch}
            onSearchChange={(v) => { setInterviewSearch(v); setInterviewPage(1); }}
            searchPlaceholder="Search interviews by candidate, position or interviewer..."
            filters={[
              {
                id: 'status',
                ariaLabel: 'Status Filter',
                value: interviewStatusFilter,
                onChange: (v) => { setInterviewStatusFilter(v); setInterviewPage(1); },
                options: [
                  { value: '', label: 'All Interview Statuses' },
                  { value: 'Scheduled', label: 'Scheduled Only' },
                  { value: 'Completed', label: 'Completed Only' },
                  { value: 'Cancelled', label: 'Cancelled Only' },
                  { value: 'No Show', label: 'No Show' },
                ],
              },
            ]}
            onExport={handleExportInterviews}
            exportLabel="Export CSV"
            primaryAction={{
              label: 'Schedule Interview',
              icon: <Plus size={14} />,
              onClick: () => {
                if (candidates.length > 0) {
                  handleOpenScheduleModal(candidates[0]);
                } else {
                  showError('No Candidates', 'Please source candidates first before scheduling interviews.');
                }
              },
            }}
          />

          <DataTable
            columns={interviewColumns}
            data={interviews.filter(i => {
              const s = interviewSearch.trim().toLowerCase();
              return !s || i.candidateName.toLowerCase().includes(s) || i.appliedFor.toLowerCase().includes(s) || i.interviewerName.toLowerCase().includes(s);
            })}
            loading={loadingInterviews}
            emptyMessage="No interview rounds currently scheduled."
            pagination={{
              page: interviewPage,
              pageSize: interviewPageSize,
              totalCount: interviews.length,
              totalPages: Math.ceil(interviews.length / interviewPageSize),
              onPageChange: setInterviewPage,
              onPageSizeChange: (s) => { setInterviewPageSize(s); setInterviewPage(1); },
            }}
          />
        </div>
      )}

      {/* 6. Tab 3: Positions & Openings */}
      {activeTab === 'openings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {overview.positions?.map((pos: any, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-3 relative hover:border-[var(--gold-500)]/60 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[4px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center font-bold text-xs">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-[var(--ink)]">{pos.position}</h3>
                      <p className="font-data text-[10px] text-[var(--ink-muted)]">Active Role</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--rule)] text-center">
                  <div>
                    <span className="text-[10px] text-[var(--ink-muted)] block">Total Applicants</span>
                    <span className="font-data font-bold text-sm text-[var(--ink)]">{pos.totalApplicants}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 block">In Progress</span>
                    <span className="font-data font-bold text-sm text-amber-700">{pos.active}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block">Hired</span>
                    <span className="font-data font-bold text-sm text-emerald-700">{pos.hired}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCandidatePositionFilter(pos.position);
                    setActiveTab('candidates');
                  }}
                  className="w-full mt-2 py-1 px-2 text-[11px] font-semibold text-[var(--gold-500)] bg-[var(--paper)] border border-[var(--rule)] rounded-[2px] hover:border-[var(--gold-500)] transition-colors cursor-pointer text-center"
                >
                  View Pipeline Applicants →
                </button>
              </div>
            ))}

            {overview.positions?.length === 0 && (
              <div className="col-span-3 py-12 text-center text-xs text-[var(--ink-muted)] card p-8">
                No active positions recorded. Add candidates to populate job roles.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & DRAWERS */}
      {/* ========================================================================= */}

      {/* 1. Add Candidate Modal */}
      {candidateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <UserPlus size={16} className="text-[var(--gold-500)]" />
                <span>Source New Candidate</span>
              </h3>
              <button onClick={() => setCandidateModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCandidate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  value={candidateForm.candidateName}
                  onChange={(e) => setCandidateForm({ ...candidateForm, candidateName: e.target.value })}
                  placeholder="e.g. Vikram Sharma"
                  className="register-input w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                    placeholder="e.g. vikram@example.com"
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Applied Position *</label>
                  <input
                    type="text"
                    value={candidateForm.appliedFor}
                    onChange={(e) => setCandidateForm({ ...candidateForm, appliedFor: e.target.value })}
                    placeholder="e.g. Senior Civil Engineer"
                    className="register-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Source</label>
                  <select
                    value={candidateForm.source}
                    onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
                    className="register-input w-full text-xs"
                  >
                    <option value="Direct Portal">Direct Application</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Naukri.com">Naukri / Job Portal</option>
                    <option value="Employee Referral">Employee Referral</option>
                    <option value="Campus Recruitment">Campus Recruitment</option>
                    <option value="Headhunter / Agency">Agency / Headhunter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Current CTC (₹ / Annum)</label>
                  <input
                    type="number"
                    value={candidateForm.currentSalary}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentSalary: e.target.value })}
                    placeholder="e.g. 650000"
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Expected CTC (₹ / Annum)</label>
                  <input
                    type="number"
                    value={candidateForm.expectedSalary}
                    onChange={(e) => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })}
                    placeholder="e.g. 850000"
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Resume File (PDF / Word)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="register-input w-full file:mr-3 file:py-1 file:px-2 file:rounded-[2px] file:border-0 file:text-xs file:bg-[var(--navy-900)] file:text-[var(--gold-500)] file:font-semibold cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Interviewer / Recruiter Notes</label>
                <textarea
                  value={candidateForm.notes}
                  onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })}
                  placeholder="Key strengths, notice period, domain experience..."
                  rows={2}
                  className="register-input w-full"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setCandidateModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Schedule Interview Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Calendar size={16} className="text-amber-500" />
                <span>Schedule Interview Round</span>
              </h3>
              <button onClick={() => setScheduleModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleScheduleInterview} className="space-y-3 text-xs">
              <div className="p-2.5 bg-[var(--paper)] rounded-[4px] border border-[var(--rule)]">
                <span className="text-[10px] text-[var(--ink-muted)] block">Candidate</span>
                <span className="font-semibold text-xs text-[var(--ink)]">{selectedCandidate?.candidateName}</span>
                <span className="text-[10px] text-[var(--gold-500)] block font-medium">{selectedCandidate?.appliedFor}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Interview Round</label>
                  <select
                    value={interviewForm.round}
                    onChange={(e) => setInterviewForm({ ...interviewForm, round: e.target.value })}
                    className="register-input w-full text-xs"
                  >
                    <option value="Round 1 (Screening)">Round 1 (Screening)</option>
                    <option value="Round 2 (Technical)">Round 2 (Technical)</option>
                    <option value="Round 3 (Managerial)">Round 3 (Managerial)</option>
                    <option value="HR & Culture Round">HR & Culture Round</option>
                    <option value="Final Executive Round">Final Executive Round</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Interview Mode</label>
                  <select
                    value={interviewForm.interviewType}
                    onChange={(e) => setInterviewForm({ ...interviewForm, interviewType: e.target.value as any })}
                    className="register-input w-full text-xs"
                  >
                    <option value="In-Person">In-Person (Office)</option>
                    <option value="Video">Video Call (Google Meet / Zoom)</option>
                    <option value="Phone">Telephonic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={interviewForm.interviewDateTime}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interviewDateTime: e.target.value })}
                  className="register-input w-full font-data"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Interviewer Name *</label>
                  <input
                    type="text"
                    value={interviewForm.interviewerName}
                    onChange={(e) => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })}
                    placeholder="e.g. Lead Architect"
                    className="register-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Interviewer Phone</label>
                  <input
                    type="tel"
                    value={interviewForm.interviewerPhone}
                    onChange={(e) => setInterviewForm({ ...interviewForm, interviewerPhone: e.target.value })}
                    placeholder="+91..."
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Location / Meeting URL</label>
                <input
                  type="text"
                  value={interviewForm.location}
                  onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
                  placeholder="Meeting room / https://meet.google.com/..."
                  className="register-input w-full font-mono text-[11px]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setScheduleModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Interview Feedback Modal */}
      {feedbackModalOpen && selectedInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Interview Outcome & Feedback</span>
              </h3>
              <button onClick={() => setFeedbackModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFeedback} className="space-y-3 text-xs">
              <div className="p-2.5 bg-[var(--paper)] rounded-[4px] border border-[var(--rule)]">
                <span className="font-semibold text-xs text-[var(--ink)] block">{selectedInterview.candidateName}</span>
                <span className="text-[10px] text-[var(--ink-muted)] block font-data">{selectedInterview.round} • {selectedInterview.interviewerName}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Interview Status</label>
                  <select
                    value={feedbackForm.status}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, status: e.target.value })}
                    className="register-input w-full text-xs"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="No Show">Candidate No Show</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Evaluation Outcome</label>
                  <select
                    value={feedbackForm.result}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, result: e.target.value })}
                    className="register-input w-full text-xs font-semibold"
                  >
                    <option value="Pass">Pass (Recommended for next stage)</option>
                    <option value="Hold">On Hold</option>
                    <option value="Fail">Reject</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Detailed Interviewer Feedback</label>
                <textarea
                  value={feedbackForm.feedback}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                  placeholder="Technical assessment, problem-solving skills, communication, fit..."
                  rows={4}
                  className="register-input w-full"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setFeedbackModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 1-Click Hire Modal */}
      {hireModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <UserCheck size={16} className="text-emerald-500" />
                <span>Onboard Candidate to Staff Directory</span>
              </h3>
              <button onClick={() => setHireModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteHire} className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-[4px]">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider block">Candidate</span>
                <span className="font-semibold text-xs text-[var(--ink)] block">{selectedCandidate.candidateName}</span>
                <span className="text-[11px] text-[var(--ink-muted)]">Position: {selectedCandidate.appliedFor} • Phone: {selectedCandidate.phone || 'N/A'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Employee ID (Optional Auto-Assigned)</label>
                  <input
                    type="number"
                    value={hireForm.employeeId}
                    onChange={(e) => setHireForm({ ...hireForm, employeeId: e.target.value })}
                    placeholder="Auto-generated if blank"
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Joining Date *</label>
                  <input
                    type="date"
                    value={hireForm.joiningDate}
                    onChange={(e) => setHireForm({ ...hireForm, joiningDate: e.target.value })}
                    className="register-input w-full font-data"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Department</label>
                  <select
                    value={hireForm.departmentId}
                    onChange={(e) => setHireForm({ ...hireForm, departmentId: e.target.value })}
                    className="register-input w-full text-xs"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Designation</label>
                  <select
                    value={hireForm.designationId}
                    onChange={(e) => setHireForm({ ...hireForm, designationId: e.target.value })}
                    className="register-input w-full text-xs"
                  >
                    <option value="">Select Designation</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Probation Period (Days)</label>
                  <input
                    type="number"
                    value={hireForm.probationDays}
                    onChange={(e) => setHireForm({ ...hireForm, probationDays: parseInt(e.target.value) || 0 })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Default Week Off</label>
                  <select
                    value={hireForm.weekoff}
                    onChange={(e) => setHireForm({ ...hireForm, weekoff: e.target.value })}
                    className="register-input w-full text-xs"
                  >
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setHireModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Complete Hiring & Create Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Candidate Profile & Timeline Drawer */}
      {candidateDrawerOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setCandidateDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-[var(--surface)] border-l border-[var(--rule)] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-[var(--rule)] pb-3">
                <div>
                  <span className="font-data text-[10px] text-[var(--gold-500)] font-bold">CANDIDATE #{selectedCandidate.candidateId}</span>
                  <h2 className="font-display text-lg font-bold text-[var(--ink)]">{selectedCandidate.candidateName}</h2>
                  <p className="text-xs text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                    <Briefcase size={12} /> {selectedCandidate.appliedFor}
                  </p>
                </div>
                <button onClick={() => setCandidateDrawerOpen(false)} className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Stage Progress Pills */}
              <div>
                <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block mb-1.5">Current Stage</span>
                <div className="flex flex-wrap gap-1">
                  {STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleStageChange(selectedCandidate.candidateId, s.id)}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                        selectedCandidate.status === s.id
                          ? `${s.color} ring-1 ring-[var(--ink)]`
                          : 'bg-[var(--paper)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact & Compensation Details */}
              <div className="p-3 bg-[var(--paper)] rounded-[4px] border border-[var(--rule)] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Phone</span>
                  <span className="font-data font-semibold text-[var(--ink)]">{selectedCandidate.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Email</span>
                  <span className="font-data text-[var(--ink)]">{selectedCandidate.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Source</span>
                  <span className="text-[var(--ink)]">{selectedCandidate.source || 'Direct'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-muted)]">Expected CTC</span>
                  <span className="font-data font-bold text-emerald-700 dark:text-emerald-300">
                    {selectedCandidate.expectedSalary ? `₹${selectedCandidate.expectedSalary.toLocaleString()}` : '—'}
                  </span>
                </div>
                {selectedCandidate.currentSalary && (
                  <div className="flex justify-between">
                    <span className="text-[var(--ink-muted)]">Current CTC</span>
                    <span className="font-data text-[var(--ink)]">₹{selectedCandidate.currentSalary.toLocaleString()}</span>
                  </div>
                )}
                {selectedCandidate.hasResume && (
                  <div className="pt-2 border-t border-[var(--rule)] flex justify-between items-center">
                    <span className="text-[var(--ink-muted)]">Resume Document</span>
                    <button
                      onClick={() => handleDownloadResume(selectedCandidate.candidateId)}
                      className="btn-outline text-[11px] py-1 px-2.5 flex items-center gap-1"
                    >
                      <Download size={12} /> Download PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedCandidate.notes && (
                <div>
                  <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block mb-1">Recruiter Notes</span>
                  <p className="text-xs bg-[var(--paper)] p-2.5 rounded-[4px] border border-[var(--rule)] text-[var(--ink)]">
                    {selectedCandidate.notes}
                  </p>
                </div>
              )}

              {/* Interview Timeline */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">Interview History</span>
                <div className="space-y-2">
                  {drawerTimeline.map((item: any) => (
                    <div key={item.id} className="p-2.5 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--ink)]">{item.round}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] ${item.result === 'Pass' ? 'bg-emerald-100 text-emerald-800' : item.result === 'Fail' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>
                          {item.result || item.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--ink-muted)] font-data">
                        {new Date(item.interviewDateTime).toLocaleString()} • {item.interviewerName} ({item.interviewType})
                      </p>
                      {item.feedback && <p className="text-[11px] text-[var(--ink)] italic bg-[var(--surface)] p-1.5 rounded-[2px]">{item.feedback}</p>}
                    </div>
                  ))}

                  {drawerTimeline.length === 0 && (
                    <p className="text-[11px] text-[var(--ink-muted)] italic py-2">No interviews scheduled yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[var(--rule)] flex gap-2">
              <button
                onClick={() => {
                  setCandidateDrawerOpen(false);
                  handleOpenScheduleModal(selectedCandidate);
                }}
                className="btn-outline flex-1 py-1.5 text-xs flex items-center justify-center gap-1"
              >
                <Calendar size={13} /> Schedule Interview
              </button>
              {selectedCandidate.status !== 'Hired' && (
                <button
                  onClick={() => {
                    setCandidateDrawerOpen(false);
                    handleOpenHireModal(selectedCandidate);
                  }}
                  className="btn-primary flex-1 py-1.5 text-xs flex items-center justify-center gap-1"
                >
                  <UserCheck size={13} /> Hire Candidate
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Candidate Applications"
        templateFilename="HRDesk_Candidates_Template"
        templateHeaders={['CandidateName', 'Email', 'Phone', 'AppliedFor', 'Source', 'ExpectedSalary', 'Notes']}
        templateSampleRow={['Pooja Patel', 'pooja@example.com', '+91 98765 12345', 'Senior Accountant', 'LinkedIn', '750000', 'Immediate joiner']}
        onImportComplete={() => {
          showSuccess('Import Complete', 'Candidates imported to pipeline.');
          fetchCandidates();
          fetchOverview();
        }}
      />
    </PageContainer>
  );
};

