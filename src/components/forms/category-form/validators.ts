export function validateCategoryName(name: string): boolean {
  return !!name.trim()
}

export function validateCategoryDisplayName(
  value: string,
  maxLength: number,
): string | undefined {
  const v = value.trim()
  if (!v) return `Name is required`
  if (v.length > maxLength)
    return `Name must be ${maxLength} characters or fewer`
  return undefined
}
