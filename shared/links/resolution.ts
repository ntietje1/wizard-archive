import { parseWikiLinkText } from './parsing'
import type { ParsedWikiLinkFields } from './parsing'

export function parseResolvableWikiItemPath(text: string): ParsedWikiLinkFields | null {
  const parsed = parseWikiLinkText(text)
  if (
    parsed.displayName !== null ||
    parsed.headingPath.length > 0 ||
    parsed.itemPath.length === 0
  ) {
    return null
  }
  return parsed
}
