'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export function SearchParamsHandler({ onRedirectParamFound }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const redirectParam = String(searchParams?.get?.('redirect') || '').trim()
    if (redirectParam.startsWith('http')) {
      window.sessionStorage.setItem('zaryah-return-to-seller', redirectParam)
      onRedirectParamFound?.(redirectParam)
      return
    }
    const stored = window.sessionStorage.getItem('zaryah-return-to-seller')
    onRedirectParamFound?.(stored || '')
  }, [searchParams, onRedirectParamFound])

  return null
}
