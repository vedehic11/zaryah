'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react'
import { apiService } from '../../services/api'
import toast from 'react-hot-toast'

function PaymentCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('verifying') // verifying | success | failed | pending
  const [message, setMessage] = useState('Verifying your payment...')
  const hasVerified = useRef(false)

  useEffect(() => {
    // Only run once
    if (hasVerified.current) return
    hasVerified.current = true

    const merchantOrderId = searchParams.get('merchantOrderId') || searchParams.get('merchantTransactionId')
    const merchantTransactionId = merchantOrderId
    const transactionStatus = searchParams.get('transactionStatus') // Sometimes PhonePe sends this

    if (!merchantOrderId) {
      setStatus('failed')
      setMessage('Invalid payment session. Please contact support.')
      return
    }

    // Retrieve the order context saved before redirect
    let savedOrderData = null
    let savedOrderId = null
    try {
      const raw = sessionStorage.getItem('zaryah-pendingOrder')
      if (raw) {
        const parsed = JSON.parse(raw)
        savedOrderData = parsed.orderData
        savedOrderId = parsed.orderId
      }
    } catch (e) {
      console.error('Failed to read pending order from sessionStorage', e)
    }

    const verifyPayment = async () => {
      try {
        // First check payment status from our backend
        const checkResult = await apiService.request('/payment/check-status', {
          method: 'POST',
          body: JSON.stringify({ merchantTransactionId })
        })

        const paymentStatus = checkResult?.payment?.status

        if (paymentStatus === 'captured') {
          // Payment success — verify and finalize order
          toast.loading('Finalizing your order...', { id: 'payment-verify' })

          let orderId = savedOrderId
          if (!orderId && savedOrderData) {
            const orderResponse = await apiService.request('/orders', {
              method: 'POST',
              body: JSON.stringify({
                ...savedOrderData,
                paymentId: merchantTransactionId,
                paymentStatus: 'paid'
              })
            })

            if (!orderResponse?.order) throw new Error('Order creation failed')
            orderId = orderResponse.order.id
          }

          // Now verify and credit wallets
          await apiService.request('/payment/verify', {
            method: 'POST',
            body: JSON.stringify({
              merchantTransactionId,
              order_id: orderId
            })
          })

          // Clean up session storage
          try { sessionStorage.removeItem('zaryah-pendingOrder') } catch (e) {}
          try { sessionStorage.removeItem('zaryah-buyNowItem') } catch (e) {}

          toast.success('Payment successful!', { id: 'payment-verify' })
          setStatus('success')
          setMessage('Your order has been placed successfully!')

          setTimeout(() => router.push('/orders'), 2000)

        } else {
          // Payment failed, cancelled, or pending
          if (savedOrderId) {
            try {
              await apiService.request(`/orders/${savedOrderId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: 'cancelled',
                  payment_status: 'failed',
                  notes: `Payment ${paymentStatus || 'cancelled'} by user or PhonePe.`
                })
              })
            } catch (patchErr) {
              console.error('Failed to update order status to cancelled:', patchErr)
            }
          }

          if (paymentStatus === 'failed') {
            setStatus('failed')
            setMessage(checkResult?.payment?.error_description || 'Payment was unsuccessful or cancelled. Please try again.')
            toast.error('Payment unsuccessful', { id: 'payment-verify' })
          } else {
            // Pending or cancelled/backed out
            setStatus('failed')
            setMessage('Payment was not completed. Your order was cancelled.')
            toast.error('Payment cancelled', { id: 'payment-verify' })
          }
        }

      } catch (error) {
        console.error('Payment verification error:', error)
        setStatus('failed')
        setMessage('Unable to verify payment. Please check your orders or contact support.')
        toast.error('Verification failed', { id: 'payment-verify' })
      }
    }

    verifyPayment()
  }, [searchParams, router])

  const icons = {
    verifying: <Loader className="w-16 h-16 text-primary-600 animate-spin" />,
    success: <CheckCircle className="w-16 h-16 text-green-500" />,
    failed: <XCircle className="w-16 h-16 text-red-500" />,
    pending: <Clock className="w-16 h-16 text-yellow-500" />
  }

  const titles = {
    verifying: 'Verifying Payment...',
    success: 'Payment Successful!',
    failed: 'Payment Failed',
    pending: 'Payment Processing'
  }

  const bgColors = {
    verifying: 'from-blue-50 to-primary-50',
    success: 'from-green-50 to-emerald-50',
    failed: 'from-red-50 to-pink-50',
    pending: 'from-yellow-50 to-amber-50'
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgColors[status]} flex items-center justify-center py-8`}>
      <div className="max-w-md w-full px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl shadow-2xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex justify-center mb-6"
          >
            {icons[status]}
          </motion.div>

          <h1 className="text-2xl font-bold text-charcoal-900 mb-3">
            {titles[status]}
          </h1>
          <p className="text-charcoal-600 mb-8">{message}</p>

          {status === 'failed' && (
            <div className="space-y-3">
              <button
                onClick={() => router.push('/checkout')}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/orders')}
                className="w-full border-2 border-charcoal-300 text-charcoal-700 hover:bg-charcoal-50 font-bold py-3 px-4 rounded-xl transition-colors"
              >
                View Orders
              </button>
            </div>
          )}

          {(status === 'success' || status === 'pending') && (
            <p className="text-sm text-charcoal-500">Redirecting you to your orders...</p>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-primary-50 flex items-center justify-center py-8">
        <div className="max-w-md w-full px-4 text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center">
            <Loader className="w-16 h-16 text-primary-600 animate-spin mb-6" />
            <h1 className="text-2xl font-bold text-charcoal-900 mb-3">Verifying Payment...</h1>
            <p className="text-charcoal-600">Please wait while we establish a secure connection...</p>
          </div>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  )
}
