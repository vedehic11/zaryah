'use client'

import { Layout } from '../components/Layout'

export default function ShippingPolicy() {
  return (
    <Layout>
      <div className="min-h-screen bg-cream-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-cream-100">
          <h1 className="text-3xl font-extrabold text-primary-900 mb-8 border-b border-cream-200 pb-4">
            Shipping Policy
          </h1>

          <div className="space-y-6 text-neutral-700 leading-relaxed text-sm sm:text-base">
            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Shipping Methods</h2>
            <p>
              The orders for the user are shipped through registered domestic courier companies and/or speed post only.
            </p>

            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Processing &amp; Dispatch Timeline</h2>
            <p>
              Orders are shipped and delivered within <span className="font-semibold text-primary-800">4-7 days</span> from the date of the order and/or payment, subject to courier company / post office norms.
            </p>

            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Delivery &amp; Delay Responsibility</h2>
            <p>
              The Platform Owner shall not be liable for any delay in delivery by the courier company / postal authority. Delivery of all orders will be made to the address provided by the buyer at the time of purchase. Delivery of our services will be confirmed via your registered email ID as specified at the time of registration.
            </p>

            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Shipping Charges</h2>
            <p>
              If there are any shipping cost(s) levied by the seller or the Platform Owner (as the case may be), the same is strictly non-refundable.
            </p>

            <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 mt-8">
              <h2 className="text-lg font-bold text-primary-900 mb-2">Need Shipment Updates?</h2>
              <p className="text-sm text-primary-950">
                If you have questions about your order shipment, please track it from your dashboard or contact us at <strong className="text-primary-800">vedehic@gmail.com</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
