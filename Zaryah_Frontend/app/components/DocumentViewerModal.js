'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ExternalLink, FileText, Image as ImageIcon, AlertTriangle } from 'lucide-react'

export const DocumentViewerModal = ({ isOpen, onClose, document }) => {
  if (!document) return null

  const isImage = document.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  const isPdf = document.url?.match(/\.pdf$/i)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{document.title || 'Document'}</h3>
                  {document.description && (
                    <p className="text-sm text-gray-600 mt-1">{document.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5 text-gray-600" />
                  </a>
                  <a
                    href={document.url}
                    download
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5 text-gray-600" />
                  </a>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 bg-gray-50 max-h-[70vh] overflow-auto">
                {document.url ? (
                  <>
                    {isImage && (
                      <div className="flex items-center justify-center bg-white rounded-lg p-4">
                        <img
                          src={document.url}
                          alt={document.title || 'Document'}
                          className="max-w-full h-auto rounded-lg shadow-lg"
                        />
                      </div>
                    )}

                    {isPdf && (
                      <div className="w-full bg-white rounded-lg shadow-lg" style={{ height: '600px' }}>
                        <iframe
                          src={document.url}
                          className="w-full h-full rounded-lg"
                          title={document.title || 'PDF Document'}
                        />
                      </div>
                    )}

                    {!isImage && !isPdf && (
                      <div className="text-center py-12 bg-white rounded-lg">
                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                        >
                          <ExternalLink className="w-5 h-5" />
                          <span>Open in New Tab</span>
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-600">Document URL not available</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  Close
                </button>
                <a
                  href={document.url}
                  download
                  className="inline-flex items-center space-x-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
