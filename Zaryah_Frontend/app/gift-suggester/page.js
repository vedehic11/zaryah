import { Suspense } from 'react'
import { Layout } from '../components/Layout'
import { GiftSuggesterPage } from '../components/GiftSuggesterPage'

export default function GiftSuggester() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Layout>
        <GiftSuggesterPage />
      </Layout>
    </Suspense>
  )
}