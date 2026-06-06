function normalizeAbsoluteBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/$/, '')
  if (!raw) return null

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(withProtocol)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function isLocalDevelopmentHost(value) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

export function getPublicAppUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.VERCEL_URL ||
    ''

  if (configured) {
    const normalizedConfigured = normalizeAbsoluteBaseUrl(configured)
    if (normalizedConfigured && !isLocalDevelopmentHost(normalizedConfigured)) {
      return normalizedConfigured
    }
  }

  return 'https://zaryah.in'
}

export function getServerBaseUrl(request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.VERCEL_URL ||
    ''

  if (configured) {
    const normalizedConfigured = normalizeAbsoluteBaseUrl(configured)
    if (normalizedConfigured) {
      return normalizedConfigured
    }
    console.warn('Invalid configured app URL:', configured)
  }

  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')

    if (forwardedProto && forwardedHost) {
      const normalizedForwarded = normalizeAbsoluteBaseUrl(`${forwardedProto}://${forwardedHost}`)
      if (normalizedForwarded) {
        return normalizedForwarded
      }
    }

    const originUrl = normalizeAbsoluteBaseUrl(request.nextUrl.origin)
    if (originUrl) {
      return originUrl
    }
  }

  return 'http://localhost:3000'
}
