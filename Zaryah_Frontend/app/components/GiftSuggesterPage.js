'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gift, Heart, User, Calendar, DollarSign, Sparkles } from 'lucide-react'
import { ProductCard } from './ProductCard'

export const GiftSuggesterPage = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    recipient: '',
    occasion: '',
    budget: '',
    interests: [],
    relationship: ''
  })
  const [suggestions, setSuggestions] = useState([])

  const sampleProducts = [
    {
      id: '1',
      name: 'Handcrafted Ceramic Vase',
      sellerName: 'Priya Sharma',
      price: 1299,
      image: 'https://images.pexels.com/photos/5553045/pexels-photo-5553045.jpeg?auto=compress&cs=tinysrgb&w=800',
      description: 'Beautiful handmade ceramic vase with traditional patterns',
      city: 'Mumbai',
      instantDeliveryEligible: true,
      status: 'approved',
      category: 'Home Decor',
      tags: ['handmade', 'ceramic', 'home-decor']
    },
    {
      id: '2',
      name: 'Artisan Soy Candles',
      sellerName: 'Ravi Kumar',
      price: 599,
      image: 'https://images.pexels.com/photos/5624983/pexels-photo-5624983.jpeg?auto=compress&cs=tinysrgb&w=800',
      description: 'Natural soy candles with essential oils',
      city: 'Mumbai',
      instantDeliveryEligible: true,
      status: 'approved',
      category: 'Candles',
      tags: ['handmade', 'candles', 'natural']
    }
  ]

  const recipients = ['Mother', 'Father', 'Partner', 'Friend', 'Sibling', 'Colleague', 'Other']
  const occasions = ['Birthday', 'Anniversary', 'Wedding', 'Festival', 'Graduation', 'Thank You', 'Just Because']
  const budgetRanges = ['Under ₹500', '₹500 - ₹1000', '₹1000 - ₹2500', '₹2500 - ₹5000', 'Above ₹5000']
  const interestOptions = ['Art & Crafts', 'Home Decor', 'Fashion', 'Books', 'Music', 'Cooking', 'Gardening', 'Technology']

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }))
  }

  const generateSuggestions = () => {
    // Simple suggestion logic - in real app, this would be more sophisticated
    setSuggestions(sampleProducts)
    setCurrentStep(4)
  }

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      generateSuggestions()
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-charcoal-900 font-serif mb-4">Gift Suggester</h1>
          <p className="text-xl text-charcoal-600">Find the perfect gift for your loved ones</p>
        </div>

        {/* Progress Bar */}
        {currentStep < 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4 mb-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step <= currentStep 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      step < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-gray-600">
              Step {currentStep} of 3
            </div>
          </div>
        )}

        {/* Form Steps */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <User className="w-6 h-6 mr-3 text-primary-600" />
                Tell us about the recipient
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Who are you buying for?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {recipients.map((recipient) => (
                    <button
                      key={recipient}
                      onClick={() => handleInputChange('recipient', recipient)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.recipient === recipient
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {recipient}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How close are you to them?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Very Close', 'Close', 'Somewhat Close', 'Not Very Close', 'Acquaintance', 'Professional'].map((closeness) => (
                    <button
                      key={closeness}
                      onClick={() => handleInputChange('relationship', closeness)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.relationship === closeness
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {closeness}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-primary-600" />
                Occasion & Budget
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What's the occasion?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {occasions.map((occasion) => (
                    <button
                      key={occasion}
                      onClick={() => handleInputChange('occasion', occasion)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.occasion === occasion
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {occasion}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What's your budget?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {budgetRanges.map((budget) => (
                    <button
                      key={budget}
                      onClick={() => handleInputChange('budget', budget)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.budget === budget
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {budget}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Heart className="w-6 h-6 mr-3 text-primary-600" />
                Interests & Preferences
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What are they interested in? (Select all that apply)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {interestOptions.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => handleInterestToggle(interest)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.interests.includes(interest)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center space-x-3 bg-primary-100 px-6 py-3 rounded-full mb-4">
                  <Sparkles className="w-6 h-6 text-primary-600" />
                  <span className="text-primary-700 font-semibold">Perfect Matches Found!</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Here are our suggestions for {formData.recipient}
                </h2>
                <p className="text-gray-600">
                  Based on your preferences for {formData.occasion} within {formData.budget}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {suggestions.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <div className="text-center mt-8">
                <button
                  onClick={() => {
                    setCurrentStep(1)
                    setFormData({
                      recipient: '',
                      occasion: '',
                      budget: '',
                      interests: [],
                      relationship: ''
                    })
                    setSuggestions([])
                  }}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
                >
                  Start Over
                </button>
              </div>
            </motion.div>
          )}

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                  currentStep === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>
              <button
                onClick={nextStep}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                {currentStep === 3 ? 'Get Suggestions' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}