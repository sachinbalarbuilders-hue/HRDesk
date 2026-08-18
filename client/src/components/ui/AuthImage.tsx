import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

interface AuthImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackInitial?: string;
  fallbackClassName?: string;
}

export const AuthImage: React.FC<AuthImageProps> = ({ src, fallbackInitial, fallbackClassName, className, alt, ...props }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let objectUrl: string;
    let isMounted = true;

    const fetchImage = async () => {
      if (!src) return;
      
      try {
        setLoading(true);
        const response = await apiClient.get(src, { responseType: 'blob' });
        
        if (response.data && response.data.size > 0 && isMounted) {
          objectUrl = URL.createObjectURL(response.data);
          setImageSrc(objectUrl);
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-[var(--rule)] flex items-center justify-center ${className}`}>
      </div>
    );
  }

  if (error || !imageSrc) {
    if (fallbackInitial) {
      return (
        <div className={`bg-[var(--navy-900)] text-[var(--gold-500)] font-bold flex items-center justify-center ${fallbackClassName || className}`}>
          {fallbackInitial}
        </div>
      );
    }
    return null;
  }

  return <img src={imageSrc} alt={alt} className={className} {...props} />;
};
