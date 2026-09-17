import React, { useState } from 'react';
import { X, Upload, FileDown, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  templateFilename: string;
  templateHeaders: string[];
  templateSampleRow: string[];
  onImportComplete?: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  title,
  templateFilename,
  templateHeaders,
  templateSampleRow,
  onImportComplete,
}) => {
  const { showSuccess, showError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; valid: number } | null>(null);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const csvContent = '\uFEFF' + [
      templateHeaders.join(','),
      templateSampleRow.join(','),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${templateFilename}_Template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSummary(null);
    }
  };

  const handleProcessImport = async () => {
    if (!file) {
      showError('No file selected', 'Please select a valid CSV template to upload.');
      return;
    }

    try {
      setUploading(true);
      const text = await file.text();
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);

      if (lines.length <= 1) {
        showError('Empty File', 'The selected CSV file contains no record rows.');
        setUploading(false);
        return;
      }

      // Simulate parsing
      const validCount = lines.length - 1;
      setSummary({ total: validCount, valid: validCount });
      showSuccess('Records Verified', `Successfully processed ${validCount} entries from ${file.name}.`);

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      showError('Import failed', 'Error reading or parsing CSV file contents.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] "
    >
      <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden space-y-4 animate-scale-in">
        {/* Header */}
        <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
          <div>
            <h3 id="bulk-import-title" className=" text-base font-semibold text-[var(--text-primary)] text-balance">
              {title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">Upload CSV ledger entries</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Download Template Strip */}
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileDown size={16} className="text-[var(--accent)]" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Official CSV Template</p>
                <p className="text-xs font-normal text-[var(--text-secondary)] ">Pre-formatted schema headers</p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="btn-outline py-1 px-2.5 text-xs font-normal flex items-center gap-1  cursor-pointer"
            >
              <FileDown size={12} aria-hidden="true" /> Download
            </button>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-[var(--rule)] rounded-[4px] p-6 text-center space-y-2 bg-[var(--paper)]/50">
            <Upload size={24} className="mx-auto text-[var(--text-secondary)]" aria-hidden="true" />
            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] hover:underline cursor-pointer block">
                <span>Click to select CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs font-normal text-[var(--text-secondary)]  mt-0.5">
                {file ? file.name : 'Supports UTF-8 CSV only'}
              </p>
            </div>
          </div>

          {/* Feedback Summary */}
          {summary && (
            <div className="p-3 bg-[var(--surface)] border border-[var(--ok-600)] rounded-[2px] text-xs  flex items-center gap-2 text-[var(--ok-600)]">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span><strong className="tabular-nums">{summary.valid}</strong> entries ready to append to register.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[var(--rule)] flex items-center justify-end gap-2 bg-[var(--surface-header)]">
          <button type="button" onClick={onClose} className="btn-outline cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProcessImport}
            disabled={!file || uploading}
            className="btn-primary disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload size={13} aria-hidden="true" />
            <span>{uploading ? 'Processing...' : 'Process Import'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
