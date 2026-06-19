'use client'

import { useRouter } from 'next/navigation'
import { Construction, ChevronLeft } from 'lucide-react'

export const HamperBuilderPage = () => {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8 flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-cream-100 text-center">
        <div className="inline-flex p-4 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-600 mb-6 animate-pulse">
          <Construction className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-charcoal-900 font-serif mb-3">
          Under Construction
        </h1>
        <p className="text-charcoal-600 text-base leading-relaxed mb-8">
          Our Hamper Builder is currently under development. Soon you'll be able to create customized gift hampers from our full catalog of handcrafted products.
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors shadow-soft"
        >
          <ChevronLeft className="w-5 h-5" /> Go Back
        </button>
      </div>
    </div>
  )
}