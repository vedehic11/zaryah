'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { optimizeImageUrl, SVG_PLACEHOLDER } from '@/lib/url-utils'

/**
 * A drop-in replacement for next/image that optimizes external image hosting (Supabase, Cloudinary)
 * and falls back gracefully to the original unoptimized URL, and finally to a static SVG placeholder on load failure.
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
  const getInitialSrc = () => {
    if (!src) return SVG_PLACEHOLDER
    return optimizeImageUrl(src, width, quality)
  }

  const [imgSrc, setImgSrc] = useState(getInitialSrc)
  const [loadStage, setLoadStage] = useState(0) // 0: Optimized, 1: Original, 2: SVG Placeholder

  // Sync state if source or parameters change
  useEffect(() => {
    setLoadStage(0)
    if (!src) {
      setImgSrc(SVG_PLACEHOLDER)
    } else {
      setImgSrc(optimizeImageUrl(src, width, quality))
    }
  }, [src, width, quality])

  const handleError = (e) => {
    if (loadStage === 0 && src && imgSrc !== src) {
      // Stage 0 -> 1: Fallback to original unoptimized URL
      setImgSrc(src)
      setLoadStage(1)
    } else if (loadStage < 2) {
      // Stage 1 -> 2: Fallback to static SVG placeholder
      setImgSrc(SVG_PLACEHOLDER)
      setLoadStage(2)
    } else {
      // Stage 2 failed (should never happen for base64 SVG)
      if (onError) {
        onError(e)
      }
    }
  }

  // Ensure src is never empty when passed to Next.js image
  const finalSrc = imgSrc || SVG_PLACEHOLDER

  return (
    <Image
      src={finalSrc}
      alt={alt}
      onError={handleError}
      unoptimized
      {...props}
    />
  )
}
