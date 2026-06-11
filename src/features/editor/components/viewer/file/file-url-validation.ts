type FileUrlValidationOptions = {
  allowObjectUrl?: boolean
}

/**
 * Validates that a file URL meets viewer security requirements.
 *
 * Live storage URLs must use the configured Convex storage origin. Local object
 * URLs are opt-in for ephemeral browser-only surfaces such as the public demo.
 */
export function isValidFileUrl(
  url: string,
  { allowObjectUrl = false }: FileUrlValidationOptions = {},
): boolean {
  try {
    const parsed = new URL(url)

    if (allowObjectUrl && parsed.protocol === 'blob:') {
      return true
    }

    const convexUrl = import.meta.env.VITE_CONVEX_URL
    if (!convexUrl) {
      return false
    }

    if (parsed.protocol !== 'https:') {
      return false
    }

    const convexParsed = new URL(convexUrl)
    if (parsed.origin !== convexParsed.origin) {
      return false
    }

    return /^\/api\/storage\/[^/]+$/.test(parsed.pathname)
  } catch {
    return false
  }
}
