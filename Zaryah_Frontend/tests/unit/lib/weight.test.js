import { describe, it, expect } from 'vitest'
import { normalizeWeightToKg, formatWeightDisplay } from '@/lib/weight'

describe('weight utilities', () => {
  describe('normalizeWeightToKg', () => {
    it('returns default for nullish values', () => {
      expect(normalizeWeightToKg(null, 1)).toBe(1)
      expect(normalizeWeightToKg(undefined, 2)).toBe(2)
      expect(normalizeWeightToKg('', 3)).toBe(3)
    })

    it('parses explicit kilogram strings', () => {
      expect(normalizeWeightToKg('2kg')).toBe(2)
      expect(normalizeWeightToKg('0.5 kg')).toBe(0.5)
    })

    it('parses explicit gram strings', () => {
      expect(normalizeWeightToKg('500g')).toBe(0.5)
      expect(normalizeWeightToKg('1500 g')).toBe(1.5)
    })

    it('treats numeric values as grams', () => {
      expect(normalizeWeightToKg(2)).toBe(0.002)
      expect(normalizeWeightToKg(500)).toBe(0.5)
      expect(normalizeWeightToKg('12')).toBe(0.012)
    })

    it('returns default for invalid or non-positive values', () => {
      expect(normalizeWeightToKg('abc', 1.2)).toBe(1.2)
      expect(normalizeWeightToKg(0, 1.2)).toBe(1.2)
      expect(normalizeWeightToKg(-2, 1.2)).toBe(1.2)
    })
  })

  describe('formatWeightDisplay', () => {
    it('formats grams for numeric and unit values', () => {
      expect(formatWeightDisplay(2)).toBe('2 g')
      expect(formatWeightDisplay('1.5kg')).toBe('1500 g')
    })

    it('formats grams for values already in grams', () => {
      expect(formatWeightDisplay('500g')).toBe('500 g')
      expect(formatWeightDisplay(0.25)).toBe('250 g')
    })

    it('returns null for invalid input', () => {
      expect(formatWeightDisplay('')).toBeNull()
      expect(formatWeightDisplay('foo')).toBeNull()
    })
  })
})
