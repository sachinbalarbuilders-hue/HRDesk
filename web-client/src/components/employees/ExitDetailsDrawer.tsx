import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  X,
  UserMinus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Upload,
  Star,
  CheckSquare,
  ShieldCheck,
  Building,
  Briefcase,
  Phone,
  UserCheck,
  Send,
} from 'lucide-react';

interface ExitDetailsDrawerProps {
  isOpen: boolean;
  exitId: number | null;
  onClose: () => void;
  onRefresh: () => void;
  canEdit?: boolean;
}

interface ClearanceItem {
  id: string;
  department: string;
  task: string;
  completed: boolean;
  remarks?: string;
}

const DEFAULT_CLEARANCE_ITEMS: ClearanceItem[] = [
  { id: 'it_laptop', department: 'IT Department', task: 'Laptop, charger & accessories handed over', completed: false },
  { id: 'it_access', department: 'IT Department', task: 'Email, VPN & software licenses revoked', completed: false },
  { id: 'admin_id', department: 'Admin & Facilities', task: 'Physical ID Card, biometric & keys surrendered', completed: false },
  { id: 'fin_advance', department: 'Finance & Accounts', task: 'Salary advances & active loans reconciled', completed: false },
  { id: 'fin_claims', department: 'Finance & Accounts', task: 'Expense claims & petty cash cleared', completed: false },
  { id: 'hr_docs', department: 'Human Resources', task: 'Exit interview conducted & NDA obligations signed', completed: false },
];

export const ExitDetailsDrawer: React.FC<ExitDetailsDrawerProps> = ({
  isOpen,
  exitId,
  onClose,
  onRefresh,
  canEdit = true,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exit, setExit] = useState<any>(null);

  // Clearance Checklist State
  const [clearanceList, setClearanceList] = useState<ClearanceItem[]>(DEFAULT_CLEARANCE_ITEMS);
  const [handoverStatus, setHandoverStatus] = useState('Pending');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Exit Interview State
  const [exitInterviewCompleted, setExitInterviewCompleted] = useState(false);
  const [exitInterviewRating, setExitInterviewRating] = useState<number>(4);
  const [exitInterviewNotes, setExitInterviewNotes] = useState('');

  // Modal / Confirm Sub-states
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [adjustedLwd, setAdjustedLwd] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchExitDetails = async () => {
    if (!exitId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/employee-exits/${exitId}`);
      if (res.data) {
        setExit(res.data);
        setAdjustedLwd(res.data.lastWorkingDate || '');
        setHandoverStatus(res.data.handoverStatus || 'Pending');
        setHandoverNotes(res.data.handoverNotes || '');
        setExitInterviewCompleted(res.data.exitInterviewCompleted || false);
        setExitInterviewRating(res.data.exitInterviewRating || 4);
        setExitInterviewNotes(res.data.exitInterviewNotes || '');

        if (res.data.clearanceChecklistJson) {
          try {
            setClearanceList(JSON.parse(res.data.clearanceChecklistJson));
          } catch {
            setClearanceList(DEFAULT_CLEARANCE_ITEMS);
          }
        } else {
          setClearanceList(DEFAULT_CLEARANCE_ITEMS);
        }
      }
    } catch {
      showError('Failed to load exit details', 'Unable to retrieve record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && exitId) {
      fetchExitDetails();
    }
  }, [isOpen, exitId]);

  if (!isOpen) return null;

  const handleToggleClearance = (id: string) => {
    setClearanceList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleSaveClearance = async () => {
    if (!exitId) return;
    try {
      setSaving(true);
      await apiClient.put(`/employee-exits/${exitId}/clearance`, {
        clearanceChecklistJson: JSON.stringify(clearanceList),
        handoverStatus,
        handoverNotes,
        exitInterviewCompleted,
        exitInterviewRating,
        exitInterviewNotes,
      });
      showSuccess('Saved', 'Clearance checklist and interview saved.');
      fetchExitDetails();
      onRefresh();
    } catch (err: any) {
      showError('Save Failed', err?.response?.data?.message || 'Server error');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!exitId) return;
    try {
      setSaving(true);
      await apiClient.put(`/employee-exits/${exitId}/approve`, {
        adjustedLastWorkingDate: adjustedLwd || undefined,
        remarks: approveRemarks || undefined,
      });
      showSuccess('Approved', 'Resignation approved. Employee is now serving notice period.');
      setApproveModalOpen(false);
      fetchExitDetails();
      onRefresh();
    } catch (err: any) {
      showError('Approval Failed', err?.response?.data?.message || 'Server error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!exitId) return;
    if (!rejectReason) {
      showError('Reason Required', 'Please enter a rejection reason.');
      return;
    }
    try {
      setSaving(true);
      await apiClient.put(`/employee-exits/${exitId}/reject`, {
        reason: rejectReason,
      });
      showSuccess('Rejected', 'Resignation request rejected.');
      setRejectModalOpen(false);
      fetchExitDetails();
      onRefresh();
    } catch (err: any) {
      showError('Rejection Failed', err?.response?.data?.message || 'Server error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteRelieve = async () => {
    if (!exitId) return;
    const confirm = window.confirm(
      `Are you sure you want to officially RELIEVE ${exit.employeeName}? This will set their status to Inactive and revoke system login access.`
    );
    if (!confirm) return;

    try {
      setSaving(true);
      const res = await apiClient.post(`/employee-exits/${exitId}/complete`);
      showSuccess('Employee Relieved', res.data?.message || 'Exit completed successfully.');
      fetchExitDetails();
      onRefresh();
    } catch (err: any) {
      showError('Relieve Failed', err?.response?.data?.message || 'Server error');
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !exitId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setSaving(true);
        await apiClient.post(`/employee-exits/${exitId}/documents`, {
          documentType: docType,
          documentBase64: reader.result as string,
          fileName: file.name,
          contentType: file.type || 'application/pdf',
        });
        showSuccess('Document Uploaded', `${docType} document attached successfully.`);
        fetchExitDetails();
      } catch (err: any) {
        showError('Upload Failed', err?.response?.data?.message || 'Server error');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDocDownload = (docType: string) => {
    if (!exitId) return;
    window.open(`/api/employee-exits/${exitId}/documents/${docType}`, '_blank');
  };

  const completedClearanceCount = clearanceList.filter((c) => c.completed).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-2xl bg-[var(--surface)] h-full shadow-2xl flex flex-col border-l border-[var(--border)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center font-semibold">
              <UserMinus size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span>{exit?.employeeName || 'Exit Dossier'}</span>
                <span className="text-xs  text-[var(--text-secondary)] px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--border)]">
                  {exit?.employeeCode}
                </span>
              </h2>
              <p className="text-sm font-normal text-[var(--text-secondary)]">
                {exit?.designation || 'Designation'} · {exit?.department || 'Department'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-sm font-normal text-[var(--text-secondary)]">Loading exit dossier...</div>
          ) : !exit ? (
            <div className="py-12 text-center text-sm font-normal text-[var(--text-secondary)]">No record found.</div>
          ) : (
            <>
              {/* Status & Notice KPI Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[var(--surface-secondary)] rounded-[var(--radius-md)] border border-[var(--border)]">
                <div>
                  <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Status</span>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        exit.status === 'Completed'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
                          : exit.status === 'InNoticePeriod'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          : exit.status === 'ClearancePending'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      }`}
                    >
                      {exit.status}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Exit Type</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{exit.exitType}</p>
                </div>

                <div>
                  <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Notice Days Left</span>
                  <p className="text-sm font-semibold text-[var(--success)] mt-1">
                    {exit.remainingDays > 0 ? `${exit.remainingDays} days` : 'Notice Served'}
                  </p>
                </div>

                <div>
                  <span className="text-xs uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Last Working Day</span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{exit.lastWorkingDate}</p>
                </div>
              </div>

              {/* Reason & Background */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase size={13} className="text-[var(--accent)]" />
                  <span>Exit Reason & Notes</span>
                </h3>
                <div className="p-3 bg-[var(--surface-secondary)] rounded-[var(--radius-sm)] border border-[var(--border)] text-sm font-normal space-y-1">
                  <div className="font-semibold text-[var(--text-primary)]">{exit.reason}</div>
                  {exit.reasonDetails && <p className="text-[var(--text-secondary)]">{exit.reasonDetails}</p>}
                  <div className="pt-2 text-xs font-normal text-[var(--text-secondary)] flex items-center gap-3">
                    <span>Notice Date: <strong>{exit.resignationDate}</strong></span>
                    <span>Rehire Eligible: <strong>{exit.isEligibleForRehire ? 'Yes' : 'No'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Document Attachments */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-[var(--accent)]" />
                  <span>Exit & Relieving Documents</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Resignation Letter */}
                  <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between text-sm font-normal">
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">Resignation Letter</div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {exit.hasResignationDoc ? exit.resignationDocName || 'Attached' : 'Not attached'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {exit.hasResignationDoc && (
                        <button
                          onClick={() => handleDocDownload('resignation')}
                          className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <label className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer">
                        <Upload size={13} />
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleDocUpload('resignation', e)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Relieving Letter */}
                  <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between text-sm font-normal">
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">Relieving Letter</div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {exit.hasRelievingDoc ? exit.relievingDocName || 'Attached' : 'Not attached'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {exit.hasRelievingDoc && (
                        <button
                          onClick={() => handleDocDownload('relieving')}
                          className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <label className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer">
                        <Upload size={13} />
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleDocUpload('relieving', e)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Experience Certificate */}
                  <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between text-sm font-normal">
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">Experience Certificate</div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {exit.hasExperienceDoc ? exit.experienceDocName || 'Attached' : 'Not attached'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {exit.hasExperienceDoc && (
                        <button
                          onClick={() => handleDocDownload('experience')}
                          className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <label className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer">
                        <Upload size={13} />
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleDocUpload('experience', e)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Clearance Form */}
                  <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between text-sm font-normal">
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">Clearance Form</div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {exit.hasClearanceDoc ? exit.clearanceDocName || 'Attached' : 'Not attached'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {exit.hasClearanceDoc && (
                        <button
                          onClick={() => handleDocDownload('clearance')}
                          className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <label className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--accent)]/20 text-[var(--text-primary)] cursor-pointer">
                        <Upload size={13} />
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleDocUpload('clearance', e)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Clearance Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare size={13} className="text-[var(--accent)]" />
                    <span>Department Clearance Checklist ({completedClearanceCount}/{clearanceList.length})</span>
                  </h3>
                </div>

                <div className="p-3 bg-[var(--surface-secondary)] rounded-[var(--radius-sm)] border border-[var(--border)] space-y-2">
                  {clearanceList.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-2.5 p-2 rounded hover:bg-[var(--surface)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleClearance(item.id)}
                        className="mt-0.5 w-4 h-4 rounded text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)] cursor-pointer"
                      />
                      <div className="text-sm font-normal">
                        <span className={`font-semibold ${item.completed ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                          {item.task}
                        </span>
                        <span className="block text-xs text-[var(--accent)] ">{item.department}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Exit Interview Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Star size={13} className="text-[var(--accent)]" />
                  <span>Exit Interview & Feedback</span>
                </h3>

                <div className="p-3 bg-[var(--surface-secondary)] rounded-[var(--radius-sm)] border border-[var(--border)] space-y-3 text-sm font-normal">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exitInterviewCompleted}
                        onChange={(e) => setExitInterviewCompleted(e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)] cursor-pointer"
                      />
                      <span className="font-semibold text-[var(--text-primary)]">Exit Interview Completed</span>
                    </label>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[var(--text-secondary)] mr-1">Experience Rating:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setExitInterviewRating(star)}
                          className={`cursor-pointer ${
                            star <= exitInterviewRating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-700'
                          }`}
                        >
                          <Star size={14} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Interview Notes & Suggestions
                    </label>
                    <textarea
                      rows={2}
                      value={exitInterviewNotes}
                      onChange={(e) => setExitInterviewNotes(e.target.value)}
                      placeholder="Record employee feedback, overall experience, and reasons..."
                      className="register-input w-full text-sm font-normal resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Save Checklist & Interview */}
              {canEdit && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveClearance}
                    disabled={saving}
                    className="btn-outline cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Clearance & Interview'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {exit && canEdit && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {exit.status === 'Submitted' && (
                <>
                  <button
                    onClick={() => setApproveModalOpen(true)}
                    className="btn-primary cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve Resignation</span>
                  </button>
                  <button
                    onClick={() => setRejectModalOpen(true)}
                    className="btn-outline text-[var(--danger)] border-[var(--danger)]/40 hover:bg-red-500/10 cursor-pointer"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>

            {exit.status !== 'Completed' && (
              <button
                onClick={handleCompleteRelieve}
                disabled={saving}
                className="btn-primary bg-purple-600 hover:bg-purple-700 text-white cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <ShieldCheck size={14} />
                <span>Complete Offboarding & Relieve</span>
              </button>
            )}
          </div>
        )}

        {approveModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-2xl max-w-sm w-full p-5 space-y-3">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Approve Resignation</h3>
              <div className="space-y-2 text-sm font-normal">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Confirm / Adjust Last Working Date
                  </label>
                  <input
                    type="date"
                    value={adjustedLwd}
                    onChange={(e) => setAdjustedLwd(e.target.value)}
                    className="register-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Approval Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={approveRemarks}
                    onChange={(e) => setApproveRemarks(e.target.value)}
                    placeholder="Approval comments..."
                    className="register-input w-full resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setApproveModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className="btn-primary cursor-pointer"
                >
                  Confirm Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {rejectModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-2xl max-w-sm w-full p-5 space-y-3">
              <h3 className="text-base font-semibold text-[var(--danger)]">Reject Resignation</h3>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this resignation is rejected or retained..."
                  className="register-input w-full text-sm font-normal resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="btn-primary bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
