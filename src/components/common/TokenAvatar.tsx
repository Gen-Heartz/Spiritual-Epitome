import React, { useEffect, useState } from 'react';
import {
  ensureObjectUrl,
  getCachedObjectUrl,
  onImageCacheUpdated,
} from '../../utils/imageProcessor';

interface TokenAvatarProps {
  imageId: string;
  alt: string;
  size?: number;
  borderColor?: string;
  fallbackText?: string;
}

export const TokenAvatar: React.FC<TokenAvatarProps> = ({
  imageId,
  alt,
  size = 38,
  borderColor = 'rgba(201, 166, 92, 0.55)',
  fallbackText,
}) => {
  const [url, setUrl] = useState<string | null>(() =>
    getCachedObjectUrl(imageId)
  );

  useEffect(() => {
    let active = true;
    if (!imageId) {
      setUrl(null);
      return;
    }
    const immediate = getCachedObjectUrl(imageId);
    if (immediate) {
      setUrl(immediate);
    } else {
      ensureObjectUrl(imageId).then((loaded) => {
        if (active) setUrl(loaded);
      });
    }

    const unsub = onImageCacheUpdated(() => {
      const next = getCachedObjectUrl(imageId);
      if (next && active) setUrl(next);
    });

    return () => {
      active = false;
      unsub();
    };
  }, [imageId]);

  const initials = (fallbackText || alt || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `1.5px solid ${borderColor}`,
        background: 'radial-gradient(circle at 35% 30%, #263147, #0e131d)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.max(10, Math.round(size * 0.34)),
        color: '#e6c67c',
        boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
      }}
      title={alt}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
