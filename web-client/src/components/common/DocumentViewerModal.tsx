import React from 'react';
import { Download, X } from 'lucide-react';

interface DocumentViewerModalProps {
  viewingDoc: {
    url: string;
    type: string;
    name: string;
  } | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ viewingDoc, onClose }) => {
  if (!viewingDoc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 bg-black/50 text-white">
        <h3 className="text-lg font-medium truncate">{viewingDoc.name}</h3>
        <div className="flex items-center gap-4">
          <a
            href={viewingDoc.url}
            download={viewingDoc.name}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors text-sm"
          >
            <Download size={16} />
            Download
          </a>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            title="Close Viewer"
          >
            <X size={24} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
        {viewingDoc.type.startsWith('image/') ? (
          <img src={viewingDoc.url} alt={viewingDoc.name} className="max-w-full max-h-full object-contain shadow-2xl rounded" />
        ) : (
          <iframe src={viewingDoc.url} className="w-full h-full bg-white rounded shadow-2xl" />
        )}
      </div>
    </div>
  );
};
