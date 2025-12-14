export function validateCategoryName(
  autoPluralize: boolean,
  categoryName: string,
  name: string,
  pluralName: string,
): boolean {
  if (autoPluralize) {
    return !!categoryName.trim()
  }
  return !!name.trim() && !!pluralName.trim()
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
