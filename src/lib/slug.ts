export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  const withHyphens = lower.replace(/[\s_]+/g, '-')
  const cleaned = withHyphens.replace(/[^a-z0-9-]/g, '')
  const collapsed = cleaned.replace(/-+/g, '-')
  return collapsed.replace(/^-+/, '').replace(/-+$/, '')
}

export function appendSuffix(base: string, n: number): string {
  return n <= 1 ? base : `${base}-${n}`
}
