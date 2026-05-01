import { NextResponse } from 'next/server'

const MAX_SIZE = 1024
const DEFAULT_SIZE = 160

function normalizeSize(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return DEFAULT_SIZE
  return Math.min(Math.max(parsed, 64), MAX_SIZE)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const data = searchParams.get('data') || ''
    const size = normalizeSize(searchParams.get('size'))
    const download = searchParams.get('download') === '1'

    if (!data.trim()) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
    const response = await fetch(qrUrl)

    if (!response.ok) {
      return NextResponse.json({ error: 'QR generation failed' }, { status: 502 })
    }

    const arrayBuffer = await response.arrayBuffer()
    const headers = new Headers({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400'
    })

    if (download) {
      headers.set('Content-Disposition', 'attachment; filename="zaryah-profile-qr.png"')
    }

    return new Response(arrayBuffer, { status: 200, headers })
  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
