export type EditorSearch = {
  item?: string
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
    result.item = item
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
