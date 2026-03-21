/**
 * Validates an email address format.
 * Shared between frontend (inline validation) and backend (mutation guard).
 */
export function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email cannot be empty'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address'
  }
  return null
}
