export type EditorSearch = {
  category?: string
  folder?: string
  map?: string
  note?: string
  tag?: string
  page?: string
}

export const validateSearch = (
  search: Record<string, unknown>,
): EditorSearch => {
  const result: EditorSearch = {}

  // Extract all potential content type params
  const note =
    'note' in search &&
    typeof search.note === 'string' &&
    search.note.trim().length > 0
      ? search.note.trim()
      : undefined

  const tag =
    'tag' in search &&
    typeof search.tag === 'string' &&
    search.tag.trim().length > 0
      ? search.tag.trim()
      : undefined

  const map =
    'map' in search &&
    typeof search.map === 'string' &&
    search.map.trim().length > 0
      ? search.map.trim()
      : undefined

  const category =
    'category' in search &&
    typeof search.category === 'string' &&
    search.category.trim().length > 0
      ? search.category.trim()
      : undefined

  const folder =
    'folder' in search &&
    typeof search.folder === 'string' &&
    search.folder.trim().length > 0
      ? search.folder.trim()
      : undefined

  // Mutual exclusivity: only one content type param can be present
  // Priority: note > tag > map > category > folder
  if (note) {
    result.note = note
  } else if (tag) {
    result.tag = tag
  } else if (map) {
    result.map = map
  } else if (category) {
    result.category = category
  } else if (folder) {
    result.folder = folder
  }

  // page is allowed when note or tag is present
  if (
    (result.note || result.tag) &&
    'page' in search &&
    typeof search.page === 'string' &&
    search.page.trim().length > 0
  ) {
    result.page = search.page.trim()
  }

  return result
}
