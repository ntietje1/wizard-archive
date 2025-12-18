export function validateTagDescription(
  value: string,
  maxLength: number,
): string | undefined {
  const v = value.trim()
  if (!v) return undefined
  if (v.length > maxLength)
    return `Description must be ${maxLength} characters or fewer`
  return undefined
}

export function validateTagName(
  value: string,
  maxLength: number,
): string | undefined {
  const v = value.trim()
  if (!v) return `Name is required`
  if (v.length > maxLength)
    return `Name must be ${maxLength} characters or fewer`
  return undefined
}
