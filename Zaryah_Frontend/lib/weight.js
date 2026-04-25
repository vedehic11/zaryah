function toNumber(value) {
  const num = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(num) ? num : null
}

function trimTrailingZeros(value, maxDecimals = 2) {
  return Number(value.toFixed(maxDecimals)).toString()
}

/**
 * Normalize weight to kilograms.
 *
 * Heuristics for backward compatibility:
 * - Numeric values <= 10 are treated as kilograms (legacy data)
 * - Numeric values > 10 are treated as grams (current seller form input)
 * - Strings with explicit units (kg/g) are parsed by unit
 */
export function normalizeWeightToKg(rawWeight, defaultKg = null) {
  if (rawWeight === null || rawWeight === undefined || rawWeight === '') {
    return defaultKg
  }

  if (typeof rawWeight === 'string') {
    const weightText = rawWeight.trim().toLowerCase()
    if (!weightText) return defaultKg

    if (weightText.includes('kg')) {
      const kg = toNumber(weightText)
      return kg && kg > 0 ? kg : defaultKg
    }

    if (weightText.includes('g')) {
      const grams = toNumber(weightText)
      return grams && grams > 0 ? grams / 1000 : defaultKg
    }

    const numericWeight = toNumber(weightText)
    if (!numericWeight || numericWeight <= 0) return defaultKg
    return numericWeight > 10 ? numericWeight / 1000 : numericWeight
  }

  const numericWeight = toNumber(rawWeight)
  if (!numericWeight || numericWeight <= 0) return defaultKg
  return numericWeight > 10 ? numericWeight / 1000 : numericWeight
}

export function formatWeightDisplay(rawWeight) {
  const weightKg = normalizeWeightToKg(rawWeight, null)
  if (!weightKg || weightKg <= 0) return null

  if (weightKg >= 1) {
    return `${trimTrailingZeros(weightKg, 2)} kg`
  }

  return `${trimTrailingZeros(weightKg * 1000, 0)} g`
}
