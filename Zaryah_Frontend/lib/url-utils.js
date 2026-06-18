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
  if (!url || typeof url !== 'string') return url || '/placeholder.jpg'

  // Relative path or local asset
  if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
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
