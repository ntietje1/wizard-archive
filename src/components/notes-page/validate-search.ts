export type EditorSearch = {
  category?: string
  folder?: string
  map?: string
  note?: string
  tag?: string
  file?: string
}

export const validateSearch = (
  search: Record<string, unknown>,
): EditorSearch => {
  const result: EditorSearch = {}

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

  const file =
    'file' in search &&
    typeof search.file === 'string' &&
    search.file.trim().length > 0
      ? search.file.trim()
      : undefined

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
  } else if (file) {
    result.file = file
  }

  return result
}
