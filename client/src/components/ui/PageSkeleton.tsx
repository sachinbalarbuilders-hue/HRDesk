import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. Header with Register Rule */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="space-y-1.5">
            <div className="h-6 w-48 bg-[var(--rule)]/60 rounded-[2px]" />
            <div className="h-3 w-72 bg-[var(--rule)]/40 rounded-[2px]" />
          </div>
          <div className="h-7 w-28 bg-[var(--rule)]/60 rounded-[4px]" />
        </div>
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Horizontal Register Headcount Strip Skeleton */}
      <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-3.5 w-24 bg-[var(--rule)]/50 rounded-[2px]" />
          <div className="h-4 w-16 bg-[var(--rule)]/60 rounded-[2px]" />
          <div className="h-4 w-16 bg-[var(--rule)]/60 rounded-[2px]" />
          <div className="h-4 w-16 bg-[var(--rule)]/60 rounded-[2px]" />
        </div>
        <div className="h-3 w-20 bg-[var(--rule)]/40 rounded-[2px]" />
      </div>

      {/* 3. Ruled Ledger Table Skeleton */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        {/* Table Header */}
        <div className="h-9 bg-[var(--surface-header)] border-b border-[var(--rule)] flex items-center px-3 gap-4">
          <div className="h-3 w-32 bg-[var(--rule)]/60 rounded-[2px]" />
          <div className="h-3 w-24 bg-[var(--rule)]/50 rounded-[2px]" />
          <div className="h-3 w-28 bg-[var(--rule)]/50 rounded-[2px]" />
          <div className="h-3 w-20 bg-[var(--rule)]/50 rounded-[2px]" />
          <div className="h-3 w-16 bg-[var(--rule)]/50 rounded-[2px] ml-auto" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--rule)]">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-10 px-3 flex items-center gap-4 bg-[var(--surface)]">
              <div className="w-6 h-6 rounded-[2px] bg-[var(--rule)]/40 flex-shrink-0" />
              <div className="h-3.5 w-36 bg-[var(--rule)]/50 rounded-[2px]" />
              <div className="h-3 w-20 bg-[var(--rule)]/30 rounded-[2px]" />
              <div className="h-3 w-28 bg-[var(--rule)]/30 rounded-[2px]" />
              <div className="h-3 w-24 bg-[var(--rule)]/30 rounded-[2px]" />
              <div className="h-3.5 w-14 bg-[var(--rule)]/40 rounded-[2px] ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="divide-y divide-[var(--rule)] animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 px-3 flex items-center gap-4 bg-[var(--surface)]">
          <div className="w-5 h-5 rounded-[2px] bg-[var(--rule)]/40 flex-shrink-0" />
          <div className="h-3.5 w-32 bg-[var(--rule)]/50 rounded-[2px]" />
          <div className="h-3 w-20 bg-[var(--rule)]/30 rounded-[2px]" />
          <div className="h-3 w-24 bg-[var(--rule)]/30 rounded-[2px]" />
          <div className="h-3.5 w-12 bg-[var(--rule)]/40 rounded-[2px] ml-auto" />
        </div>
      ))}
    </div>
  );
};
