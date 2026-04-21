/**
 * ENCRYPTION SECURITY NOTICE
 *
 * This module provides client-side encryption using the Web Crypto API.
 *
 * What it protects against:
 * - Casual inspection of IndexedDB in DevTools
 * - Simple malware that scans for plain text credentials
 * - Data being readable in browser database exports
 *
 * What it does NOT protect against:
 * - Determined attackers with direct device access (they can read localStorage)
 * - Browser extensions that can access localStorage
 * - Malicious code running in the same origin
 *
 * Why localStorage for the encryption key:
 * - Pure client-side apps cannot securely store secrets without a backend
 * - Web Crypto API requires the key to be available in JavaScript memory
 * - Storing the key in localStorage is a known limitation but still provides
 *   meaningful protection against casual inspection
 * - For production apps, consider using the Web Authentication API or a
 *   password-derived key (user must re-enter password to unlock the app)
 */

const KEY_STORAGE_KEY = 'iptv_player_enc_key'
const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12

/**
 * Gets an existing encryption key from localStorage or creates a new one
 */
export async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const storedKey = localStorage.getItem(KEY_STORAGE_KEY)

  if (storedKey) {
    const keyData = JSON.parse(storedKey)
    return await crypto.subtle.importKey(
      'jwk',
      keyData,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )

  const exportedKey = await crypto.subtle.exportKey('jwk', key)
  localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(exportedKey))

  return key
}

/**
 * Encrypts a plaintext string using AES-GCM
 * Returns a base64-encoded string containing IV + ciphertext
 */
export async function encryptString(plaintext: string): Promise<string> {
  const key = await getOrCreateEncryptionKey()
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts a base64-encoded string containing IV + ciphertext
 * Returns the plaintext string
 */
export async function decryptString(ciphertext: string): Promise<string> {
  const key = await getOrCreateEncryptionKey()
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

  const iv = combined.slice(0, IV_LENGTH)
  const encrypted = combined.slice(IV_LENGTH)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encrypted,
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Deletes the encryption key from localStorage
 * WARNING: This makes all encrypted data permanently unreadable
 */
export function clearEncryptionKey(): void {
  localStorage.removeItem(KEY_STORAGE_KEY)
}
