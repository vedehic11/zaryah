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
            <p>
              The orders for the user are shipped through registered domestic courier companies and/or speed post 
              only. Orders are shipped and delivered within <strong>4-7 days</strong> from the date of the order 
              and/or payment or as per the delivery date agreed at the time of order confirmation and 
              delivering of the shipment, subject to courier company / post office norms. Platform Owner shall 
              not be liable for any delay in delivery by the courier company / postal authority. Delivery of 
              all orders will be made to the address provided by the buyer at the time of purchase. Delivery of 
              our services will be confirmed on your email ID as specified at the time of registration. If there 
              are any shipping cost(s) levied by the seller or the Platform Owner (as the case be), the same is 
              not refundable.
            </p>

            <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 mt-8">
              <h2 className="text-lg font-bold text-primary-900 mb-2">Merchant Contact &amp; Entity Details</h2>
              <div className="space-y-1.5 text-sm text-primary-950 mt-3">
                <p><strong>Merchant Legal Entity Name:</strong> Vedehi Ajay Choudhary (Proprietor of Zaryah)</p>
                <p><strong>Registered Address:</strong> 14, shivsagar society, shingada talav, gurudwara road, nashik, Maharashtra, 422001</p>
                <p><strong>Customer Support Phone:</strong> +91 7822855390</p>
                <p><strong>Customer Support Email:</strong> vedehic@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
