'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { optimizeImageUrl } from '@/lib/url-utils'

/**
 * A drop-in replacement for next/image that optimizes external image hosting (Supabase, Cloudinary)
 * and falls back gracefully to the original unoptimized URL on load failure.
 *
 * @param {string} src - Original image source
 * @param {string} alt - Alt text
 * @param {number} width - Target optimization width
 * @param {number} quality - Target quality (1-100)
 * @param {function} onError - Optional callback on final load error
 */
export default function OptimizedImage({
  src,
  alt = 'Image',
  width = 600,
  quality = 80,
  onError,
  ...props
}) {
  const [imgSrc, setImgSrc] = useState(() => optimizeImageUrl(src, width, quality))
  const [hasTriedFallback, setHasTriedFallback] = useState(false)

  // Sync state if source or parameters change
  useEffect(() => {
    setImgSrc(optimizeImageUrl(src, width, quality))
    setHasTriedFallback(false)
  }, [src, width, quality])

  const handleError = (e) => {
    if (!hasTriedFallback && imgSrc !== src) {
      // Fallback to original unoptimized URL
      setImgSrc(src)
      setHasTriedFallback(true)
    } else {
      // Both optimized and original failed
      if (onError) {
        onError(e)
      }
    }
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      onError={handleError}
      unoptimized
      {...props}
    />
  )
}
