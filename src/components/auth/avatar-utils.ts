/**
 * Returns avatar fallback text: up to 2 initials from the name,
 * the first letter of the email, or a default placeholder.
 */
export function getAvatarFallback(
  name?: string | null,
  email?: string | null,
  fallback = 'U',
): string {
  if (name) {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    if (initials) return initials
  }
  if (email) return email[0].toUpperCase()
  return fallback
}
