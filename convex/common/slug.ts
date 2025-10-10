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

export function appendSuffix(base: string, n: number): string {
  return n <= 1 ? base : `${base}-${n}`
}

export async function findUniqueSlug(name: string, checkFn: (slug: string) => Promise<boolean>): Promise<string> {
  const normalized = slugify(name)
  let uniqueSlug = normalized
  let suffix = 1
  for (let i = 0; i < 100; i++) { // 100 max checks
    const conflict = await checkFn(uniqueSlug)
    if (!conflict) break
    suffix += 1
    uniqueSlug = appendSuffix(normalized, suffix)
  }
  const finalConflict = await checkFn(uniqueSlug)
  if (finalConflict) {
    throw new Error(`Failed to find unique slug for: ${name}`)
  }
  return uniqueSlug
}

