'use client'

import { useState, useEffect } from 'react'
import { Star, User, Calendar, ThumbsUp, MessageSquare } from 'lucide-react'
import { apiService } from '../services/api'

export const Reviews = ({ productId, showWriteReview = false, onWriteReview }) => {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!productId) return
    fetchReviews()
  }, [productId])

  const fetchReviews = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.getProductReviews(productId)
      setReviews(data)
    } catch (err) {
      setError('Failed to load reviews')
      console.error('Error fetching reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const renderStars = (rating) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  const getAverageRating = () => {
    if (reviews.length === 0) return 0
    const total = reviews.reduce((sum, review) => sum + review.rating, 0)
    return (total / reviews.length).toFixed(1)
  }

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach(review => {
      distribution[review.rating]++
    })
    return distribution
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-primary-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-primary-100 p-6">
        <div className="text-center text-charcoal-600">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-soft border border-primary-100">
      {/* Header */}
      <div className="p-6 border-b border-primary-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Star className="w-6 h-6 text-yellow-400 fill-current" />
              <span className="text-2xl font-bold text-charcoal-900">
                {getAverageRating()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-charcoal-900">
                Customer Reviews
              </h3>
              <p className="text-sm text-charcoal-600">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {showWriteReview && onWriteReview && (
            <button
              onClick={onWriteReview}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Star className="w-4 h-4" />
              <span>Write Review</span>
            </button>
          )}
        </div>

        {/* Rating Distribution */}
        {reviews.length > 0 && (
          <div className="mt-4 space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = getRatingDistribution()[rating] || 0
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
              return (
                <div key={rating} className="flex items-center space-x-2">
                  <span className="text-sm text-charcoal-600 w-8">{rating}★</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-charcoal-600 w-12">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="p-6">
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h4 className="text-lg font-semibold text-charcoal-900 mb-2">
              No reviews yet
            </h4>
            <p className="text-charcoal-600">
              Be the first to review this product!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div key={review._id} className="border-b border-gray-100 pb-6 last:border-b-0">
                {/* Review Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-charcoal-900">
                        {review.buyer?.name || 'Anonymous'}
                      </h4>
                      <div className="flex items-center space-x-2 text-sm text-charcoal-600">
                        {renderStars(review.rating)}
                        <span>•</span>
                        <span>{formatDate(review.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Title */}
                {review.title && (
                  <h5 className="font-semibold text-charcoal-900 mb-2">
                    {review.title}
                  </h5>
                )}

                {/* Review Comment */}
                <p className="text-charcoal-700 leading-relaxed mb-3">
                  {review.comment}
                </p>

                {/* Review Images */}
                {review.images && review.images.length > 0 && (
                  <div className="flex space-x-2 mb-3">
                    {review.images.map((image, index) => (
                      <div key={index} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                        <img
                          src={image}
                          alt={`Review image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Review Footer */}
                <div className="flex items-center space-x-4 text-sm text-charcoal-500">
                  <div className="flex items-center space-x-1">
                    <ThumbsUp className="w-4 h-4" />
                    <span>Helpful</span>
                  </div>
                  <span>•</span>
                  <span>Verified Purchase</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 