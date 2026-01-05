/**
 * Validates that a file URL meets security requirements.
 *
 * Requirements:
 * - Must use HTTPS protocol
 * - Origin must match Convex deployment URL
 * - Path must match Convex storage pattern: /api/storage/[storageId]
 */
export function isValidFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const convexUrl = (import.meta as any).env.VITE_CONVEX_URL

    // Must use HTTPS
    if (parsed.protocol !== 'https:') {
      return false
    }

    try {
      const convexParsed = new URL(convexUrl)
      // Check if origin matches Convex deployment
      if (parsed.origin !== convexParsed.origin) {
        return false
      }
      // Check if path matches storage pattern: /api/storage/[storageId]
      const storagePathPattern = /^\/api\/storage\/[^/]+$/
      if (!storagePathPattern.test(parsed.pathname)) {
        return false
      }
    } catch {
      // If Convex URL is invalid, fall back to basic validation
      return false
    }

    return true
  } catch {
    return false
  }
}
