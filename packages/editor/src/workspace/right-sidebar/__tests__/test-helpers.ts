import type { FileSystemSearch } from '../../../filesystem/search'

export function createAvailableSearch({
  getItemLinks,
}: Pick<
  Extract<Extract<FileSystemSearch, { status: 'available' }>['itemLinks'], { status: 'available' }>,
  'getItemLinks'
>) {
  return {
    status: 'available' as const,
    ensureSearchState: () => undefined,
    getSearchState: () => ({
      bodySearchError: null,
      bodySearchPending: false,
      recentItems: [],
      results: [],
    }),
    itemLinks: { status: 'available' as const, getItemLinks },
  } satisfies FileSystemSearch
}
