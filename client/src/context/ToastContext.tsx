import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast('success', title, message);
  }, [showToast]);

  const showError = useCallback((title: string, message?: string) => {
    showToast('error', title, message);
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, removeToast }}>
      {children}

      {/* Floating Register Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((toast) => {
          let borderAccent = 'border-l-[var(--ok-600)]';
          let icon = <CheckCircle2 size={16} className="text-[var(--ok-600)] flex-shrink-0 mt-0.5" />;
          let badgeText = 'SUCCESS';
          let badgeColor = 'text-[var(--ok-600)] bg-[var(--ok-600)]/10';

          if (toast.type === 'error') {
            borderAccent = 'border-l-[var(--err-600)]';
            icon = <XCircle size={16} className="text-[var(--err-600)] flex-shrink-0 mt-0.5" />;
            badgeText = 'ERROR';
            badgeColor = 'text-[var(--err-600)] bg-[var(--err-600)]/10';
          } else if (toast.type === 'warning') {
            borderAccent = 'border-l-[var(--warn-600)]';
            icon = <AlertTriangle size={16} className="text-[var(--warn-600)] flex-shrink-0 mt-0.5" />;
            badgeText = 'WARNING';
            badgeColor = 'text-[var(--warn-600)] bg-[var(--warn-600)]/10';
          } else if (toast.type === 'info') {
            borderAccent = 'border-l-[var(--gold-500)]';
            icon = <Info size={16} className="text-[var(--gold-500)] flex-shrink-0 mt-0.5" />;
            badgeText = 'NOTICE';
            badgeColor = 'text-[var(--gold-500)] bg-[var(--gold-500)]/10';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto bg-[var(--surface)] border border-[var(--rule)] border-l-4 ${borderAccent} rounded-[4px] p-3 shadow-lg flex items-start gap-2.5 transition-all duration-200 animate-in slide-in-from-right`}
            >
              {icon}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1 rounded-[2px] text-[9px] font-bold font-data ${badgeColor}`}>
                    {badgeText}
                  </span>
                  <p className="text-xs font-semibold text-[var(--ink)] font-ui truncate">
                    {toast.title}
                  </p>
                </div>
                {toast.message && (
                  <p className="text-[11px] text-[var(--ink-muted)] font-ui mt-0.5 leading-snug">
                    {toast.message}
                  </p>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] p-0.5 rounded cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
