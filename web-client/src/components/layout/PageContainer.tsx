import React from 'react';
import { clsx } from 'clsx';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-full',
};

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
  maxWidth = 'xl',
}) => {
  return (
    <div className={clsx('mx-auto w-full space-y-6 animate-fade-in', maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
};
