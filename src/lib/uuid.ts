/**
 * Generate a UUID v4.
 *
 * Uses crypto.randomUUID() when available (secure contexts only),
 * falls back to a manual implementation using crypto.getRandomValues()
 * for non-secure contexts (like LAN IPs).
 *
 * crypto.getRandomValues() is available in ALL contexts, so this works
 * everywhere modern browsers run.
 */
export function generateId(): string {
  // Use built-in if available (faster and standardized)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback: build a v4 UUID manually using crypto.getRandomValues
  // crypto.getRandomValues exists in all contexts (secure or not)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // Set version (4) and variant (10xx) bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Last-resort fallback (should never hit in any modern browser)
  // Using Math.random is NOT cryptographically secure but acceptable for IDs
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}