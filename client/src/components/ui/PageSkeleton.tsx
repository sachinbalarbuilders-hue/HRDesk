import React from 'react';

const Shimmer: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-shimmer rounded-[var(--radius-md)] ${className || ''}`} />
);

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Shimmer className="h-7 w-52" />
        <Shimmer className="h-4 w-80" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 space-y-3">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="h-4 w-20" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-3 w-24 hidden sm:block" />
              <Shimmer className="h-3 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-4">
          <div className="w-7 h-7 rounded-full animate-shimmer flex-shrink-0" />
          <div className="h-4 w-32 animate-shimmer rounded-[var(--radius-sm)]" />
          <div className="h-3 w-20 animate-shimmer rounded-[var(--radius-sm)] hidden sm:block" />
          <div className="h-3 w-24 animate-shimmer rounded-[var(--radius-sm)] hidden md:block" />
          <div className="h-3.5 w-14 animate-shimmer rounded-[var(--radius-sm)] ml-auto" />
        </div>
      ))}
    </div>
  );
};
