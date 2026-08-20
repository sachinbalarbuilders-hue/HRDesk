import React from 'react';
import { clsx } from 'clsx';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div className={clsx('flex items-center gap-1 border-b border-[var(--border)]', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium cursor-pointer rounded-t-[var(--radius-md)] transition-colors',
              isActive
                ? 'text-[var(--accent)] bg-[var(--surface)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
            )}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'px-1.5 py-0.5 text-[10px] font-semibold rounded-[var(--radius-full)]',
                  isActive
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                )}
              >
                {tab.count}
              </span>
            )}
            {/* Active indicator line */}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};
