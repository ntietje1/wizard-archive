export function isFormValid(
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
