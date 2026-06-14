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
              We offer refund / exchange within the first <span className="font-semibold text-primary-800">7 days</span> from the date of your purchase. If 7 days have passed since your purchase, you will not be offered a return, exchange, or refund of any kind.
            </p>

            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Eligibility for Return or Exchange:</h2>
            <p>
              In order to become eligible for a return or an exchange, you must meet the following criteria:
            </p>
            
            <ul className="list-disc list-inside space-y-3 pl-2">
              <li>The purchased item should be unused and in the same condition as you received it.</li>
              <li>The item must have its original packaging intact.</li>
              <li>If the item was purchased on a sale, it may not be eligible for a return / exchange.</li>
              <li>Only items found to be defective or damaged will be replaced by us (based on an exchange request).</li>
            </ul>

            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Exempted Categories:</h2>
            <p>
              You agree that there may be a certain category of products or items that are exempted from returns or refunds. Such categories of products will be identified to you at the time of purchase.
            </p>

            <h2 className="text-xl font-bold text-primary-900 mt-6 mb-2">Evaluation Process:</h2>
            <p>
              For exchange or return accepted requests (as applicable), once your returned product/item is received and inspected by the seller, we will send you an email to notify you about the receipt of the returned/exchanged product. 
            </p>
            <p>
              If the return is approved after the quality check at our end, your request (i.e. return / exchange) will be processed in accordance with our policies.
            </p>

            <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 mt-8">
              <h2 className="text-lg font-bold text-primary-900 mb-2">Questions?</h2>
              <p className="text-sm text-primary-950">
                For return and exchange queries, please write to our support team at <strong className="text-primary-800">support@zaryah.in</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
