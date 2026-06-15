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
              This refund and cancellation policy outlines how you can cancel or seek a refund for a product 
              or service that you have purchased through the Platform. Under this policy:
            </p>

            <ul className="list-disc list-inside space-y-4 pl-2">
              <li>
                <strong>Cancellation Window:</strong> Cancellations will only be considered if the request is made 
                within <span className="font-semibold text-primary-800">7 days</span> of placing the order. However, 
                cancellation requests may not be entertained if the orders have been communicated to the sellers / 
                merchant(s) listed on the Platform and they have initiated the process of shipping them, or the 
                product is out for delivery. In such an event, you may choose to reject the product at the doorstep.
              </li>
              
              <li>
                <strong>Perishable Items:</strong> Zaryah does not accept cancellation requests for perishable items 
                like flowers, eatables, etc. However, a refund or replacement can be made if the user establishes that 
                the quality of the product delivered is not good.
              </li>

              <li>
                <strong>Damaged or Defective Items:</strong> In case of receipt of damaged or defective items, please 
                report this to our customer service team. The request would be entertained once the seller / merchant 
                listed on the Platform has checked and determined the same at their own end. This should be reported 
                within <span className="font-semibold text-primary-800">7 days</span> of receipt of the products.
              </li>

              <li>
                <strong>Expectation Mismatch:</strong> In case you feel that the product received is not as shown on 
                the site or as per your expectations, you must bring it to the notice of our customer service within{' '}
                <span className="font-semibold text-primary-800">7 days</span> of receiving the product. The customer 
                service team, after looking into your complaint, will take an appropriate decision.
              </li>

              <li>
                <strong>Product Warranty:</strong> In case of complaints regarding products that come with a warranty 
                from the manufacturers, please refer the issue directly to them.
              </li>

              <li>
                <strong>Processing Timeframe:</strong> In case of any refunds approved by Vedehi Ajay Choudhary, the refund will be credited within <span className="font-semibold text-primary-800">6-7 days</span> to the original source of payment method.
              </li>
            </ul>

            <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 mt-8">
              <h2 className="text-lg font-bold text-primary-900 mb-2">Need Assistance?</h2>
              <p className="text-sm text-primary-950">
                If you have any questions about cancellations or refunds, please reach out to our customer support team 
                via email at <strong className="text-primary-800">vedehic@gmail.com</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
