'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Heart, Truck, Users, Award, ArrowRight, Package, Gift, Sparkles } from 'lucide-react'
import { VideoCarousel } from './VideoCarousel'
import { ProductCard } from './ProductCard'
import Link from 'next/link'
import { apiService } from '../services/api'

export const HomePage = () => {
  const [products, setProducts] = useState([])
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const approved = await apiService.getApprovedProducts();
        
        if (isMounted) {
          setProducts(approved || []);
        }
        
        try {
          const response = await fetch('/api/sellers?featured_story=true&limit=3')
          const data = await response.json()
          if (isMounted && response.ok) {
            setSellers(data || []);
          }
        } catch (e) {
          console.error('Error fetching seller stories:', e)
        }
        
        if (isMounted) {
          setLoading(false)
        }
      } catch (e) {
        console.error('Error fetching data:', e)
        if (isMounted) {
          setError(e.message || 'Failed to load data')
          setProducts([]);
          setLoading(false)
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  const featuredProducts = (products || [])
    .filter(p => p.status === 'approved')
    .slice(0, 4)
  
  const heroRef = useRef(null)
  const { scrollY } = useScroll()
  const [heroHeight, setHeroHeight] = useState(800)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHeroHeight(window.innerHeight)
    }
  }, [])
  
  const fadeOut = useTransform(scrollY, [0, heroHeight * 0.7, heroHeight], [1, 0.7, 0])
  const scaleOut = useTransform(scrollY, [0, heroHeight * 0.7, heroHeight], [1, 0.98, 0.95])

  const categories = [
    { title: 'Resin Art', img: '/assets/resin.png', link: '/shop?category=Resin Art' },
    { title: 'Crochet', img: '/assets/crochet.png', link: '/shop?category=Crochet' },
    { title: 'Pottery', img: '/assets/pottery.png', link: '/shop?category=Pottery' },
    { title: 'Jewelry', img: '/assets/jewellery.png', link: '/shop?category=Jewelry' },
    { title: 'Candles', img: '/assets/candle.png', link: '/shop?category=Candles' },
    { title: 'Home Decor', img: '/assets/home.jpg', link: '/shop?category=Home Decor' },
    { title: 'Paper Crafts', img: '/assets/paper-craft.png', link: '/shop?category=Paper Crafts' },
    { title: 'Embroidery', img: '/assets/embroidery.png', link: '/shop?category=Embroidery' },
    { title: 'Painting', img: '/assets/paint.png', link: '/shop?category=Painting' },
    { title: 'Soap Making', img: '/assets/soap.png', link: '/shop?category=Soap Making' },
    { title: 'For Him', img: '/assets/for-him.jpg', link: '/shop?category=For Him' },
    { title: 'For Her', img: '/assets/for-her.jpg', link: '/shop?category=For Her' },
    { title: 'For Kids', img: '/assets/for-kids.jpg', link: '/shop?category=For Kids' },
    { title: 'Personalized Gifts', img: '/assets/personalised.jpg', link: '/shop?category=Personalized Gifts' },
  ]

  return (
    <div className="min-h-screen bg-gradient-elegant pt-0 md:pt-0">
      <div ref={heroRef} className="relative w-full overflow-visible mt-0">
        <motion.div
          className="sticky top-0 z-30 w-full"
          style={{ opacity: fadeOut, scale: scaleOut }}
        >
          <VideoCarousel />
        </motion.div>
      </div>

      {/* Shop by Category - Horizontal Scroll on All Screens */}
      <section className="py-10 sm:py-12 bg-cream-50 w-full">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-charcoal-800 mb-8 text-center font-serif px-4">Shop by Category</h2>
          <div className="flex space-x-4 overflow-x-auto px-4 pb-4 scrollbar-hide">
            {categories.map(cat => (
              <Link 
                href={cat.link} 
                key={cat.title} 
                className="min-w-[160px] sm:min-w-[180px] lg:min-w-[200px] flex-shrink-0 group block rounded-2xl overflow-hidden bg-white border border-cream-200 shadow-subtle hover:shadow-lg transition-all"
              >
                <div className="relative w-full h-32 overflow-hidden bg-gradient-to-br from-primary-100 to-cream-100">
                  <img 
                    src={cat.img} 
                    alt={cat.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.parentElement.classList.add('flex', 'items-center', 'justify-center')
                    }}
                  />
                  <span className="text-2xl font-bold text-primary-600 absolute inset-0 hidden items-center justify-center">{cat.title.charAt(0)}</span>
                </div>
                <div className="p-4 text-center">
                  <span className="text-base font-semibold text-charcoal-800 group-hover:text-primary-700 transition-colors">{cat.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section id="products-section" className="py-10 sm:py-12 bg-cream-100 w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center space-x-3 sm:space-x-4 bg-primary-100 px-8 sm:px-14 py-4 sm:py-6 rounded-full shadow-subtle">
            <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
            <span className="text-primary-700 font-semibold text-lg sm:text-xl">Curated Collections</span>
          </div>
        </motion.div>
        
        {/* Desktop grid */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 w-full px-4 lg:px-8 xl:px-12 mb-10">
          {featuredProducts.map((product, index) => (
            <motion.div
              key={product.id || product._id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
        
        {/* Mobile horizontal scroll */}
        <div className="sm:hidden flex space-x-4 overflow-x-auto px-4 pb-4 mb-8 scrollbar-hide">
          {featuredProducts.map((product, index) => (
            <div key={product.id || product._id} className="min-w-[280px] max-w-[300px] flex-shrink-0">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link
            href="/shop"
            className="inline-flex items-center space-x-3 sm:space-x-4 bg-white text-primary-700 px-8 sm:px-12 py-4 sm:py-5 rounded-xl font-semibold hover:shadow-xl transition-all duration-300 group text-lg sm:text-2xl"
          >
            <span>Explore Collections</span>
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </section>

      {/* Seller Stories */}
      {sellers.length > 0 && (
        <section className="py-10 sm:py-12 bg-white w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-800 mb-8 sm:mb-10 text-center font-serif">Stories That Inspire</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {sellers.map((seller) => {
                const user = seller.users || {}
                const coverPhoto = seller.cover_photo || ''
                const hasVideo = coverPhoto && (coverPhoto.endsWith('.mp4') || coverPhoto.endsWith('.webm') || coverPhoto.endsWith('.mov'))
                
                return (
                  <Link 
                    href={'/' + (seller.username || user.username)} 
                    key={seller.id}
                    className="group bg-neutral-50 rounded-2xl shadow-subtle border border-primary-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="relative w-full h-48 overflow-hidden bg-gradient-to-br from-primary-100 to-cream-100">
                      {coverPhoto && hasVideo && (
                        <video
                          src={coverPhoto}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          muted
                          loop
                          playsInline
                        />
                      )}
                      {coverPhoto && !hasVideo && (
                        <img 
                          src={coverPhoto} 
                          alt={seller.business_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      {!coverPhoto && (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-16 h-16 text-primary-300" />
                        </div>
                      )}
                      <div className="absolute -bottom-8 left-6 w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
                        {user.profile_photo ? (
                          <img 
                            src={user.profile_photo} 
                            alt={seller.business_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center">
                            <Users className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-6 pt-10">
                      <div className="mb-2">
                        <h3 className="text-xl font-bold text-primary-700 group-hover:text-primary-800 transition-colors">
                          {seller.business_name}
                        </h3>
                        {(seller.username || user.username) && (
                          <span className="text-sm text-neutral-500">@{seller.username || user.username}</span>
                        )}
                      </div>
                      <p className="text-neutral-600 line-clamp-3">
                        {seller.story || seller.business_description || 'A passionate artisan creating handmade treasures with love and care.'}
                      </p>
                      <div className="mt-4 flex items-center text-primary-600 font-medium text-sm group-hover:text-primary-700">
                        <span>Visit Shop</span>
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-12 md:py-16 lg:py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Begin Your Journey?
            </h2>
            <p className="text-base md:text-lg lg:text-xl text-primary-100 mb-8 md:mb-10 leading-relaxed">
              Join a community of thoughtful gift-givers who believe in the power of meaningful connections 
              and supporting passionate artisans.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
              <Link
                href="/shop"
                className="inline-flex items-center space-x-2 bg-white text-primary-700 px-10 md:px-12 py-4 md:py-5 rounded-2xl font-semibold hover:shadow-xl transition-all text-lg"
              >
                <span>Explore Collections</span>
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center space-x-2 bg-primary-700 hover:bg-primary-800 text-white px-10 md:px-12 py-4 md:py-5 rounded-2xl font-semibold transition-all border-2 border-primary-500 text-lg"
              >
                <span>Share Your Craft</span>
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
