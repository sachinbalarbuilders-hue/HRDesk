import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';

interface AccessRestrictedProps {
  title?: string;
  description?: string;
}

export const AccessRestricted: React.FC<AccessRestrictedProps> = ({
  title = 'Access Restricted',
  description = 'You do not have permission to access this page. Please contact your organization administrator if you believe this is an error.',
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="max-w-md w-full p-8 rounded-2xl bg-[var(--surface)] border border-[var(--rule)] shadow-lg flex flex-col items-center">
        {/* Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-5 border border-rose-500/20 shadow-inner">
          <ShieldAlert size={32} />
        </div>

        {/* Badge */}
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 mb-3">
          403 • ACCESS FORBIDDEN
        </span>

        {/* Title */}
        <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight mb-2">
          {title}
        </h2>

        {/* Description */}
        <p className="text-xs text-[var(--ink-muted)] leading-relaxed mb-6">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-lg text-xs font-medium border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--paper)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Go Back</span>
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <LayoutDashboard size={14} />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
