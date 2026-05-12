'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'

/**
 * MultiSelect component for selecting multiple options
 * @param {string} id - Unique identifier for the component
 * @param {Array<string>} options - Available options to select from
 * @param {Array<string>} selected - Currently selected values
 * @param {Function} onChange - Callback when selection changes
 * @param {string} placeholder - Placeholder text
 * @param {boolean} disabled - Whether the component is disabled
 * @param {number} maxHeight - Maximum height of dropdown in pixels
 */
export default function MultiSelect({
  id,
  options = [],
  selected = [],
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  maxHeight = 300
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selected.includes(option)
  )

  const handleSelect = (option) => {
    onChange([...selected, option])
    setSearchTerm('')
  }

  const handleRemove = (option) => {
    onChange(selected.filter(item => item !== option))
  }

  const handleClear = () => {
    onChange([])
    setSearchTerm('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input field */}
      <div className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(item => (
            <div
              key={item}
              className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-2 py-1 rounded-md text-sm"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="hover:text-primary-900"
                aria-label={`Remove ${item}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selected.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10"
          style={{ maxHeight: `${maxHeight}px`, overflowY: 'auto' }}
        >
          {filteredOptions.length > 0 ? (
            <ul className="py-1">
              {filteredOptions.map(option => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="w-full text-left px-3 py-2 hover:bg-primary-50 text-sm text-gray-700 transition-colors"
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchTerm ? 'No matching options' : 'No more options available'}
            </div>
          )}
        </div>
      )}

      {/* Clear all button (shown when selections exist) */}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 text-xs font-medium"
        >
          Clear
        </button>
      )}
    </div>
  )
}
