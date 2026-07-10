type FileUrlValidationOptions = {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
}

export function isValidFileUrl(
  url: string,
  { allowDataUrl = false, allowObjectUrl = false }: FileUrlValidationOptions = {},
): boolean {
  try {
    const parsed = new URL(url)

    if (allowObjectUrl && parsed.protocol === 'blob:') {
      return true
    }

    if (allowDataUrl && parsed.protocol === 'data:') {
      return true
    }

    // Only trusted remote file URLs are accepted; browser-valid schemes like file: and javascript: stay blocked.
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
