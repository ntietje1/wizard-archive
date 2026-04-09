export function getInitials(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim()
  const trimmedEmail = email?.trim()
  if (trimmedName) {
    const initials = trimmedName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    if (initials) return initials
  }
  if (trimmedEmail) return trimmedEmail[0].toUpperCase()
  return 'U'
}
