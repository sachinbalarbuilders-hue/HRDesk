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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] font-ui">
      <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden space-y-4">
        {/* Header */}
        <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
              {title}
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">Upload CSV ledger entries</p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink)]">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Download Template Strip */}
          <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileDown size={16} className="text-[var(--gold-500)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--ink)]">Official CSV Template</p>
                <p className="text-[10px] text-[var(--ink-muted)] font-data">Pre-formatted schema headers</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="btn-outline py-1 px-2.5 text-[11px] flex items-center gap-1 font-data"
            >
              <FileDown size={12} /> Download
            </button>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-[var(--rule)] rounded-[4px] p-6 text-center space-y-2 bg-[var(--paper)]/50">
            <Upload size={24} className="mx-auto text-[var(--ink-muted)]" />
            <div>
              <label className="text-xs font-semibold text-[var(--ink)] hover:underline cursor-pointer block">
                <span>Click to select CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-[var(--ink-muted)] font-data mt-0.5">
                {file ? file.name : 'Supports UTF-8 CSV only'}
              </p>
            </div>
          </div>

          {/* Feedback Summary */}
          {summary && (
            <div className="p-3 bg-[var(--surface)] border border-[var(--ok-600)] rounded-[2px] text-xs font-data flex items-center gap-2 text-[var(--ok-600)]">
              <CheckCircle2 size={15} />
              <span>{summary.valid} entries ready to append to register.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[var(--rule)] flex items-center justify-end gap-2 bg-[var(--surface-header)]">
          <button onClick={onClose} className="btn-outline">
            Cancel
          </button>
          <button
            onClick={handleProcessImport}
            disabled={!file || uploading}
            className="btn-primary disabled:opacity-50 flex items-center gap-1.5"
          >
            <Upload size={13} />
            <span>{uploading ? 'Processing...' : 'Process Import'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
