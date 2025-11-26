import type { Id } from 'convex/_generated/dataModel'

export type EditorSearch = {
  category?: string
  folderId?: Id<'folders'>
  map?: string
  note?: string
}

export const validateSearch = (
  search: Record<string, unknown>,
): EditorSearch => {
  const result: EditorSearch = {}

  // Extract all potential content type params
  const note =
    'note' in search && typeof search.note === 'string' && search.note.trim().length > 0
      ? search.note.trim()
      : undefined

  const map =
    'map' in search && typeof search.map === 'string' && search.map.trim().length > 0
      ? search.map.trim()
      : undefined

  const category =
    'category' in search && typeof search.category === 'string' && search.category.trim().length > 0
      ? search.category.trim()
      : undefined

  // Mutual exclusivity: only one content type param can be present
  // Priority: note > map > category
  if (note) {
    result.note = note
  } else if (map) {
    result.map = map
  } else if (category) {
    result.category = category
  }

  // folderId is always allowed (used with category)
  if ('folderId' in search && typeof search.folderId === 'string' && search.folderId.trim().length > 0) {
    result.folderId = search.folderId as Id<'folders'>
  }

  return result
}


