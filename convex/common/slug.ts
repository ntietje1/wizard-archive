export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  // Replace whitespace/underscores with hyphen
  const withHyphens = lower.replace(/[\s_]+/g, '-')
  // Remove all non a-z0-9-
  const cleaned = withHyphens.replace(/[^a-z0-9-]/g, '')
  // Collapse multiple hyphens
  const collapsed = cleaned.replace(/-+/g, '-')
  // Trim leading/trailing hyphens
  return collapsed.replace(/^-+/, '').replace(/-+$/, '')
}

/**
 * Validates a slugified username and returns an error message or null.
 */
export function validateUsername(
  slugified: string,
  raw: string,
  minLength: number,
  maxLength: number,
): string | null {
  if (slugified.length < minLength) {
    return `Username must be at least ${minLength} characters`
  }
  if (slugified.length > maxLength) {
    return `Username must be at most ${maxLength} characters`
  }
  if (raw.trim().length > 0 && slugified !== raw.trim().toLowerCase()) {
    return 'Username can only contain letters, numbers, and hyphens'
  }
  return null
}

export function appendSuffix(base: string, n: number): string {
  return n <= 1 ? base : `${base}-${n}`
}

export async function findUniqueSlug(
  name: string,
  checkFn: (slug: string) => Promise<boolean>,
): Promise<string> {
  const normalized = slugify(name)
  for (let suffix = 1; suffix <= 100; suffix++) {
    const candidate = appendSuffix(normalized, suffix)
    const conflict = await checkFn(candidate)
    if (!conflict) return candidate
  }
  throw new Error(`Failed to find unique slug for: ${name}`)
}
