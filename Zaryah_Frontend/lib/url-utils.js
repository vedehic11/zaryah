const ROOT_DOMAIN = 'zaryah.in'

export const getHostName = () => {
  if (typeof window === 'undefined') {
    return ROOT_DOMAIN
  }
  return window.location.hostname.toLowerCase()
}

export const isProductionDomain = () => {
  const host = getHostName()
  return host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)
}

export const getCurrentOrigin = () => {
  if (typeof window === 'undefined') {
    return `https://${ROOT_DOMAIN}`
  }
  return window.location.origin
}

export const getMainDomainUrl = (path = '/') => {
  if (typeof window === 'undefined') {
    return `https://${ROOT_DOMAIN}${path}`
  }

  if (isProductionDomain()) {
    return `https://${ROOT_DOMAIN}${path}`
  }

  return `${window.location.origin}${path}`
}

export const getSellerUrl = (username) => {
  if (!username) return ''
  if (typeof window === 'undefined') {
    return `https://${username}.${ROOT_DOMAIN}`
  }

  if (isProductionDomain()) {
    return `https://${username}.${ROOT_DOMAIN}`
  }

  return `${window.location.origin}/${username}`
}

export const SVG_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI0YzRjRGNiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2MCwgMTQwKSIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iNzYiIGhlaWdodD0iNzYiIHJ4PSI4Ii8+PGNpcmNsZSBjeD0iMjgiIGN5PSIyOCIgcj0iNiIvPjxwYXRoIGQ9Ik0yIDU4bDE4LTE4YTYgNiAwIDAgMSA4LjUgMEw1NCA2NiIvPjxwYXRoIGQ9Ik0yIDUwTDE0IDM4YTYgNiAwIDAgMSA4LjUgMEw3OCA2MCIvPjwvZz48dGV4dCB4PSI1MCUiIHk9IjY1JSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzlDQTNBRiI+WmFyeWFoPC90ZXh0Pjwvc3ZnPg==';

/**
 * Optimizes image URLs from Cloudinary or Supabase Storage.
 * Bypasses local next/image optimization to stay under Vercel free limits,
 * but compresses and resizes files via their respective CDNs or wsrv.nl proxy.
 *
 * @param {string} url - The original image URL
 * @param {number} width - Target width in pixels
 * @param {number} quality - Target quality (1-100)
 * @returns {string} - Optimized image URL
 */
export const optimizeImageUrl = (url, width = 600, quality = 80) => {
  if (!url || typeof url !== 'string') return SVG_PLACEHOLDER

  // Relative path or local asset
  if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
    if (url.includes('placeholder.jpg') || url.includes('placeholder-product.png')) {
      return SVG_PLACEHOLDER
    }
    return url
  }

  // 1. Cloudinary optimization
  if (url.includes('cloudinary.com')) {
    if (url.includes('/upload/')) {
      const parts = url.split('/upload/')
      // Inject auto-format (avif/webp fallback), auto-quality, and width limit
      const transformation = `q_auto:eco,f_auto,w_${width}`
      return `${parts[0]}/upload/${transformation}/${parts[1]}`
    }
    return url
  }

  // 2. Supabase Storage / Other external image CDNs
  if (url.includes('supabase.co') && url.includes('/storage/v1/object/public/')) {
    // wsrv.nl caches optimized images globally on Cloudflare.
    // This reduces Supabase Storage egress traffic to near-zero for repeating views.
    const cleanUrl = url.replace(/^https?:\/\//i, '')
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`
  }

  // General fallback for public absolute URLs
  if (/^https?:\/\//i.test(url)) {
    const cleanUrl = url.replace(/^https?:\/\//i, '')
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`
  }

  return url
}
