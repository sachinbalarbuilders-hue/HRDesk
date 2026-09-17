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
  xl: 'max-w-full',
  full: 'max-w-full',
};

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
  maxWidth = 'full',
}) => {
  return (
    <div className={clsx('w-full space-y-5 animate-fade-in', maxWidth !== 'full' && maxWidth !== 'xl' && 'mx-auto', maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
};
