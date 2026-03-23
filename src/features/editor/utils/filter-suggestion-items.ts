export function filterSuggestionItems<
  T extends { title: string; aliases?: ReadonlyArray<string> },
>(items: Array<T>, query: string): Array<T> {
  const q = query.toLowerCase().trim()
  if (!q) return items
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.aliases?.some((alias) => alias.toLowerCase().includes(q)),
  )
}
