'use client'

import { use } from 'react'
import { Layout } from '../../components/Layout'
import { ProductDetailPage } from '../../components/ProductDetailPage'

export default function ProductDetail({ params }) {
  const { id } = use(params)
  return (
    <Layout>
      <ProductDetailPage productId={id} />
    </Layout>
  )
}