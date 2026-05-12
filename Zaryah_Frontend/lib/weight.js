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
 * Product weights are stored in grams in the app. Numeric values are treated
 * as grams and converted to kilograms for shipping-rate APIs. Explicit unit
 * strings are still supported for older data.
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
    return numericWeight / 1000
  }

  const numericWeight = toNumber(rawWeight)
  if (!numericWeight || numericWeight <= 0) return defaultKg
  return numericWeight / 1000
}

export function formatWeightDisplay(rawWeight) {
  if (rawWeight === null || rawWeight === undefined || rawWeight === '') {
    return null
  }

  let grams = null

  if (typeof rawWeight === 'string') {
    const weightText = rawWeight.trim().toLowerCase()
    if (!weightText) return null

    if (weightText.includes('kg')) {
      const kg = toNumber(weightText)
      grams = kg && kg > 0 ? kg * 1000 : null
    } else {
      grams = toNumber(weightText)
    }
  } else {
    grams = toNumber(rawWeight)
  }

  if (!grams || grams <= 0) return null
  return `${trimTrailingZeros(grams, 0)} g`
}
