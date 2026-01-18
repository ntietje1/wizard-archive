export type EditorSearch = {
  folder?: string
  map?: string
  note?: string
  file?: string
  heading?: string
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

  const map =
    'map' in search &&
    typeof search.map === 'string' &&
    search.map.trim().length > 0
      ? search.map.trim()
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

  const heading =
    'heading' in search &&
    typeof search.heading === 'string' &&
    search.heading.trim().length > 0
      ? search.heading.trim()
      : undefined

  if (note) {
    result.note = note
  } else if (map) {
    result.map = map
  } else if (folder) {
    result.folder = folder
  } else if (file) {
    result.file = file
  }

  // heading can be present alongside note
  if (heading) {
    result.heading = heading
  }

  return result
}
