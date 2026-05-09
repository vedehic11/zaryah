import { NextResponse } from 'next/server'

const ROOT_DOMAIN = 'zaryah.in'
const SUBDOMAIN_SUFFIX = `.${ROOT_DOMAIN}`

function getHostname(request) {
  const hostHeader = request.headers.get('host') || ''
  return hostHeader.split(':')[0].toLowerCase()
}

export function middleware(request) {
  const hostname = getHostname(request)

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

  const url = request.nextUrl.clone()

  if (url.pathname === '/') {
    url.pathname = `/${subdomain}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|assets|favicon.ico|robots.txt|sitemap.xml).*)'],
}
