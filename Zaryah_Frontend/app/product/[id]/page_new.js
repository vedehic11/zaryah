'use client'

import { use, useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Layout } from '../../components/Layout'
import api from '../../services/api'

const ProductDetailPage = dynamic(() => import('../../components/ProductDetailPage').then(mod => mod.ProductDetailPage), {
  ssr: false
})

const MobileProductDetail = dynamic(() => import('../../components/MobileProductDetail'), {
  ssr: false
})

export default function ProductDetail({ params }) {
  const { id } = use(params)
  const [product, setProduct] = useState(null)
  const [similarProducts, setSimilarProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const productData = await api.getProduct(id)
        setProduct(productData)

        // Fetch similar products (same category)
        if (productData.category) {
          const allProducts = await api.getProducts({ category: productData.category })
          // Filter out current product and take first 6
          setSimilarProducts(
            allProducts.filter(p => p.id !== id).slice(0, 6)
          )
        }
      } catch (error) {
        console.error('Error fetching product:', error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchProduct()
    }
  }, [id])

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      </Layout>
    )
  }

  // Mobile view without Layout wrapper
  if (isMobile) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <MobileProductDetail product={product} similarProducts={similarProducts} />
      </Suspense>
    )
  }

  // Desktop view with Layout
  return (
    <Layout>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <ProductDetailPage productId={id} />
      </Suspense>
    </Layout>
  )
}
