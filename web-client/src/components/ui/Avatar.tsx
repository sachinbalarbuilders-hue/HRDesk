import React from 'react';
import { clsx } from 'clsx';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  presence?: 'online' | 'offline' | 'away' | null;
  className?: string;
}

const sizes: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const presenceColors: Record<string, string> = {
  online: 'bg-[var(--success)]',
  offline: 'bg-[var(--text-muted)]',
  away: 'bg-[var(--warning)]',
};

const presenceSizes: Record<AvatarSize, string> = {
  xs: 'w-2 h-2 -bottom-0 -right-0',
  sm: 'w-2.5 h-2.5 -bottom-0 -right-0',
  md: 'w-3 h-3 -bottom-0.5 -right-0.5',
  lg: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  xl: 'w-4 h-4 -bottom-0.5 -right-0.5',
};

// Generate a consistent gradient based on name
function getGradient(name: string): string {
  const gradients = [
    'from-teal-500 to-emerald-500',
    'from-blue-500 to-indigo-500',
    'from-violet-500 to-purple-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-cyan-500 to-blue-500',
    'from-emerald-500 to-teal-500',
    'from-indigo-500 to-violet-500',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  presence,
  className,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const initials = getInitials(name);
  const gradient = getGradient(name);

  React.useEffect(() => {
    setImageError(false);
  }, [src]);

  return (
    <div className={clsx('relative inline-flex flex-shrink-0', className)}>
      {src && !imageError ? (
        <img
          src={src}
          alt=""
          onError={() => setImageError(true)}
          className={clsx(
            'rounded-[var(--radius-full)] object-cover',
            sizes[size]
          )}
        />
      ) : (
        <div
          className={clsx(
            'rounded-[var(--radius-full)] bg-gradient-to-br flex items-center justify-center font-semibold text-white select-none',
            gradient,
            sizes[size]
          )}
        >
          {initials}
        </div>
      )}

      {presence && (
        <span
          className={clsx(
            'absolute rounded-full border-2 border-[var(--surface)]',
            presenceColors[presence],
            presenceSizes[size]
          )}
        />
      )}
    </div>
  );
};
