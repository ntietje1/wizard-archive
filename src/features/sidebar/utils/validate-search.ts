import { parseSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'

export type EditorSearch = {
  item?: SidebarItemSlug
  heading?: string
  trash?: boolean
}

export const validateSearch = (search: Record<string, unknown>): EditorSearch => {
  const result: EditorSearch = {}

  const item =
    'item' in search && typeof search.item === 'string' && search.item.trim().length > 0
      ? search.item.trim()
      : undefined

  if (item) {
    const parsedItem = parseSidebarItemSlug(item)
    if (parsedItem) {
      result.item = parsedItem
    }
  }

  const heading =
    'heading' in search && typeof search.heading === 'string' && search.heading.trim().length > 0
      ? search.heading.trim()
      : undefined

  if (heading) {
    result.heading = heading
  }

  if ('trash' in search && search.trash === true) {
    result.trash = true
  }

  return result
}
