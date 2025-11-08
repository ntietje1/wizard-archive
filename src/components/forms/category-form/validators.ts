export function validateCategoryName(
  autoPluralize: boolean,
  categoryName: string,
  displayName: string,
  pluralDisplayName: string,
): boolean {
  if (autoPluralize) {
    return !!categoryName.trim()
  }
  return !!displayName.trim() && !!pluralDisplayName.trim()
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
