'use client'

import { Layout } from '../components/Layout'

export default function ReturnPolicy() {
  return (
    <Layout>
      <div className="min-h-screen bg-cream-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-cream-100">
          <h1 className="text-3xl font-extrabold text-primary-900 mb-8 border-b border-cream-200 pb-4">
            Return Policy
          </h1>

          <div className="space-y-6 text-neutral-700 leading-relaxed text-sm sm:text-base">
            <p>
              We offer refund / exchange within first <strong>7 days</strong> from the date of your purchase. 
              If 7 days have passed since your purchase, you will not be offered a return, exchange or refund 
              of any kind. In order to become eligible for a return or an exchange, (i) the purchased item 
              should be unused and in the same condition as you received it, (ii) the item must have original 
              packaging, (iii) if the item that you purchased on a sale, then the item may not be eligible 
              for a return / exchange. Further, only such items are replaced by us (based on an exchange 
              request), if such items are found defective or damaged.
            </p>

            <p>
              You agree that there may be a certain category of products / items that are exempted from 
              returns or refunds. Such categories of the products would be identified to you at the item of 
              purchase. For exchange / return accepted request(s) (as applicable), once your returned 
              product / item is received and inspected by us, we will send you an email to notify you about 
              receipt of the returned / exchanged product. Further. If the same has been approved after the 
              quality check at our end, your request (i.e. return / exchange) will be processed in accordance 
              with our policies.
            </p>

            <p className="bg-primary-50 p-4 rounded-xl border border-primary-100 font-semibold text-primary-950">
              For return or exchange requests approved by <strong>Vedehi Ajay Choudhary (Proprietor of Zaryah)</strong>, 
              the refund will be credited within <span className="text-primary-800">6-7 days</span> to the original 
              source of payment method, and replacement or exchange products will be delivered within{' '}
              <span className="text-primary-800">4-5 days</span>.
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
