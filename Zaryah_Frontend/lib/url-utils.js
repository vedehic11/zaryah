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
