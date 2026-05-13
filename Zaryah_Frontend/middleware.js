import { NextResponse } from 'next/server'

const ROOT_DOMAIN = 'zaryah.in'
const SUBDOMAIN_SUFFIX = `.${ROOT_DOMAIN}`

function getHostname(request) {
  const hostHeader = request.headers.get('host') || ''
  return hostHeader.split(':')[0].toLowerCase()
}

export function middleware(request) {
  const hostname = getHostname(request)
  const url = request.nextUrl.clone()

  if (hostname === 'zaryah.vercel.app') {
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      const [username, ...rest] = segments
      const redirectUrl = new URL(`https://${username}.${ROOT_DOMAIN}/${rest.join('/')}`)
      redirectUrl.search = url.search
      return NextResponse.redirect(redirectUrl, 308)
    }
    return NextResponse.next()
  }

  if (!hostname || !hostname.endsWith(SUBDOMAIN_SUFFIX)) {
    return NextResponse.next()
  }

  const subdomain = hostname.slice(0, -SUBDOMAIN_SUFFIX.length)

  if (!subdomain || subdomain === 'www') {
    return NextResponse.next()
  }

  if (subdomain.includes('.')) {
    return NextResponse.next()
  }

  if (url.pathname === '/') {
    url.pathname = `/${subdomain}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|assets|favicon.ico|robots.txt|sitemap.xml).*)'],
}
