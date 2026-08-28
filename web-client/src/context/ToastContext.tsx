import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  exiting?: boolean;
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
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Start exit animation
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, type, title, message, exiting: false };
    setToasts((prev) => [...prev, newToast]);

    const timer = setTimeout(() => { removeToast(id); }, 4500);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  const showSuccess = useCallback((title: string, message?: string) => showToast('success', title, message), [showToast]);
  const showError = useCallback((title: string, message?: string) => showToast('error', title, message), [showToast]);
  const showWarning = useCallback((title: string, message?: string) => showToast('warning', title, message), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, removeToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((toast) => {
          const configs = {
            success: { border: 'border-l-[var(--success)]', icon: <CheckCircle2 size={16} className="text-[var(--success)]" />, badge: 'text-[var(--success)] bg-[var(--success-light)]' },
            error: { border: 'border-l-[var(--danger)]', icon: <XCircle size={16} className="text-[var(--danger)]" />, badge: 'text-[var(--danger)] bg-[var(--danger-light)]' },
            warning: { border: 'border-l-[var(--warning)]', icon: <AlertTriangle size={16} className="text-[var(--warning)]" />, badge: 'text-[var(--warning)] bg-[var(--warning-light)]' },
            info: { border: 'border-l-[var(--accent)]', icon: <Info size={16} className="text-[var(--accent)]" />, badge: 'text-[var(--accent)] bg-[var(--accent-light)]' },
          };
          const cfg = configs[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto bg-[var(--surface)] border border-[var(--border)] border-l-4 ${cfg.border} rounded-[var(--radius-lg)] p-3.5 shadow-[var(--shadow-lg)] flex items-start gap-3 ${
                toast.exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
              }`}
              style={toast.exiting ? { animation: 'slideOutRight 0.2s ease-out forwards' } : undefined}
            >
              <span className="flex-shrink-0 mt-0.5">{cfg.icon}</span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer flex-shrink-0"
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
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
