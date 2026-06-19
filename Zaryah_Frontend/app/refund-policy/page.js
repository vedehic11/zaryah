'use client'

import { Layout } from '../components/Layout'

export default function RefundPolicy() {
  return (
    <Layout>
      <div className="min-h-screen bg-cream-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-cream-100">
          <h1 className="text-3xl font-extrabold text-primary-900 mb-8 border-b border-cream-200 pb-4">
            Refund &amp; Cancellation Policy
          </h1>

          <div className="space-y-6 text-neutral-700 leading-relaxed text-sm sm:text-base">
            <p>
              This refund and cancellation policy outlines how you can cancel or seek a refund for a product / 
              service that you have purchased through the Platform. Under this policy:
            </p>

            <ul className="list-none space-y-4 pl-4 sm:pl-6">
              <li className="flex items-start">
                <span className="font-semibold text-primary-800 mr-2 flex-shrink-0">1.</span>
                <span>
                  Cancellations will only be considered if the request is made <strong>7 days</strong> of placing the order. 
                  However, cancellation requests may not be entertained if the orders have been communicated to such 
                  sellers / merchant(s) listed on the Platform and they have initiated the process of shipping them, 
                  or the product is out for delivery. In such an event, you may choose to reject the product at the doorstep.
                </span>
              </li>
              
              <li className="flex items-start">
                <span className="font-semibold text-primary-800 mr-2 flex-shrink-0">2.</span>
                <span>
                  In case of receipt of damaged or defective items, please report to our customer service team. The 
                  request would be entertained once the seller/ merchant listed on the Platform, has checked and 
                  determined the same at its own end. This should be reported within <strong>7 days</strong> of receipt of products. 
                  In case you feel that the product received is not as shown on the site or as per your expectations, 
                  you must bring it to the notice of our customer service within <strong>7 days</strong> of receiving the product. 
                  The customer service team after looking into your complaint will take an appropriate decision.
                </span>
              </li>

              <li className="flex items-start">
                <span className="font-semibold text-primary-800 mr-2 flex-shrink-0">3.</span>
                <span>
                  In case of complaints regarding the products that come with a warranty from the manufacturers, 
                  please refer the issue to them.
                </span>
              </li>

              <li className="flex items-start">
                <span className="font-semibold text-primary-800 mr-2 flex-shrink-0">4.</span>
                <span>
                  In case of any refunds approved by <strong>Vedehi Ajay Choudhary (Proprietor of Zaryah)</strong>, it will take 
                  <strong> 6-7 days</strong> for the refund to be processed to you.
                </span>
              </li>
            </ul>

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
