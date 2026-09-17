import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Upload, Loader2, AlertCircle, Eye } from 'lucide-react';
import { apiClient } from '../../api/client';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { useArchiveActions } from '../../hooks/useArchiveActions';
import { formatDate } from '../../utils/formatters';

interface Document {
  documentId: number;
  documentType: string;
  fileName: string;
  contentType: string;
  uploadedAt: string;
}

interface Props {
  employeeId: string;
}

export const EmployeeDocumentsTab: React.FC<Props> = ({ employeeId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; type: string; name: string } | null>(null);

  const [docType, setDocType] = useState('Aadhar Card');
  const [file, setFile] = useState<File | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/EmployeeDocuments/${employeeId}`);
      setDocuments(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchDocuments();
    }
  }, [employeeId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('documentType', docType);
      formData.append('file', file);

      await apiClient.post(`/EmployeeDocuments/${employeeId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFile(null);
      setDocType('Aadhar Card');
      await fetchDocuments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc: Document) => {
    try {
      const res = await apiClient.post(`/EmployeeDocuments/generate-view-token/${doc.documentId}`);
      const token = res.data.token;
      
      // Use the Vite proxy /api prefix or full backend URL
      const url = `/api/EmployeeDocuments/view/${token}`;
      setViewingDoc({ url, type: doc.contentType, name: doc.fileName });
    } catch (err) {
      setError('Failed to generate view token.');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const res = await apiClient.get(`/EmployeeDocuments/download/${doc.documentId}?download=true`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      setError('Failed to download document.');
    }
  };

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const docArchive = useArchiveActions({
    endpoint: '/EmployeeDocuments',
    label: 'Document',
    onDone: fetchDocuments,
  });

  if (loading) {
    return (
      <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)] flex justify-center py-8">
        <Loader2 className="animate-spin text-[var(--text-secondary)]" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Form */}
      <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
        <h4 className="text-xs uppercase font-semibold text-[var(--text-secondary)] mb-2">Upload Document</h4>
        <form onSubmit={handleUpload} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-normal text-[var(--text-secondary)] mb-1">Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="register-input w-full text-xs"
            >
              <option value="Aadhar Card">Aadhar Card</option>
              <option value="PAN Card">PAN Card</option>
              <option value="Passport">Passport</option>
              <option value="10th Marksheet / Certificate">10th Marksheet / Certificate</option>
              <option value="12th Marksheet / Certificate">12th Marksheet / Certificate</option>
              <option value="Degree Certificate">Degree Certificate</option>
              <option value="Post Graduation Certificate">Post Graduation Certificate</option>
              <option value="Resume">Resume / CV</option>
              <option value="Bank Passbook">Bank Passbook / Cheque</option>
              <option value="Offer Letter Signed">Signed Offer Letter</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-normal text-[var(--text-secondary)] mb-1">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="register-input w-full text-xs"
              required
            />
          </div>
          <button
            type="submit"
            disabled={!file || uploading}
            className="btn-primary py-2 px-3 flex items-center justify-center gap-1 min-w-[90px]"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload
          </button>
        </form>
        {error && (
          <div className="mt-2 text-xs font-normal text-[var(--danger)] flex items-center gap-1 bg-[var(--danger)]/10 p-2 rounded-[var(--radius-sm)]">
            <AlertCircle size={12} />
            {error}
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2">
        <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          <FileText size={14} className="text-[var(--accent)]" />
          <span className="text-sm">Employee Documents ({documents.length})</span>
        </div>
        
        {documents.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm font-normal text-center py-4">
            No electronic documents uploaded.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {documents.map((doc) => (
              <div key={doc.documentId} className="flex items-center justify-between p-2 hover:bg-[var(--surface)] rounded-[var(--radius-sm)] border border-transparent hover:border-[var(--border)] transition-colors group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={16} className="text-[var(--text-secondary)] flex-shrink-0" />
                  <div className="truncate">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate" title={doc.fileName}>{doc.fileName}</p>
                    <p className="text-xs font-normal text-[var(--text-secondary)]">{doc.documentType} • {formatDate(doc.uploadedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleView(doc)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                    title="View Document"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                    title="Download Document"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => docArchive.archive({ id: doc.documentId, name: doc.fileName, isArchived: false })}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentViewerModal 
        viewingDoc={viewingDoc} 
        onClose={() => setViewingDoc(null)} 
      />

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {docArchive.dialog}
    </div>
  );
};
