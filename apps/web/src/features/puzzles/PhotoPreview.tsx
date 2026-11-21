import { useEffect, useRef } from 'react';
import type { Rotation } from '@/lib/image';
import { cn } from '@/lib/utils';

/**
 * Previews a local file. The object URL is a browser resource that must be released, so it's
 * created and revoked in an effect and set on the <img> through a ref: no extra state or
 * re-render, and it stays correct when StrictMode runs effects twice in development.
 */
export function PhotoPreview({
  file,
  className,
  alt = 'Selected puzzle photo',
  rotation = 0,
}: {
  file: File;
  className?: string;
  alt?: string;
  /** Preview-only rotation (CSS). The pixels are rotated when the photo is uploaded. */
  rotation?: Rotation;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imgRef.current) imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <img
      ref={imgRef}
      alt={alt}
      className={cn('aspect-square w-full rounded-xl bg-muted object-cover', className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    />
  );
}
