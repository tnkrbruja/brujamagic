import type { IdentifierType } from './schema'

/** Best-effort identifier type from the shape of a scanned code. */
export function detectIdentifierType(code: string): IdentifierType | null {
  const value = code.trim().toUpperCase()
  if (/^B0[A-Z0-9]{8}$/.test(value)) return 'asin'
  if (/^\d{9}[\dX]$/.test(value)) return 'isbn'
  if (/^\d{13}$/.test(value)) return /^97[89]/.test(value) ? 'isbn' : 'ean'
  if (/^\d{12}$/.test(value) || /^\d{8}$/.test(value)) return 'upc'
  return null
}
