// Username generator utility for sellers
import { supabaseClient } from './supabase-client'

/**
 * Generate a unique username from business name
 * @param {string} businessName - The business name to convert to username
 * @returns {Promise<string>} - Unique username
 */
export async function generateUniqueUsername(businessName) {
  // Convert business name to valid username format
  // Rules: lowercase, alphanumeric + underscores/hyphens, 3-50 chars
  let baseUsername = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 45) // Leave room for suffixes

  // Ensure minimum length
  if (baseUsername.length < 3) {
    baseUsername = `seller-${baseUsername}${Date.now().toString().substring(8)}`
  }

  // Check if username exists
  let username = baseUsername
  let counter = 1
  let isUnique = false

  while (!isUnique && counter < 100) {
    const { data, error } = await supabaseClient
      .from('sellers')
      .select('username')
      .eq('username', username)

    if (error) {
      // Error occurred, log and assume available
      console.error('Error checking username:', error)
      isUnique = true
    } else if (!data || data.length === 0) {
      // No results = username is available
      isUnique = true
    } else {
      // Username exists, try with counter
      username = `${baseUsername}-${counter}`
      counter++
    }
  }

  // If still not unique after 100 tries, add timestamp
  if (!isUnique) {
    username = `${baseUsername}-${Date.now().toString().substring(8)}`
  }

  return username
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} - True if valid
 */
export function isValidUsername(username) {
  if (!username) return false
  
  const usernameRegex = /^[a-z0-9_-]{3,50}$/
  return usernameRegex.test(username)
}

/**
 * Check if username is available
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} - True if available
 */
export async function isUsernameAvailable(username) {
  if (!isValidUsername(username)) {
    return false
  }

  const { data, error } = await supabaseClient
    .from('sellers')
    .select('username')
    .eq('username', username)
    .single()

  // If error code is PGRST116 (not found), username is available
  return error && error.code === 'PGRST116'
}
