import type { Id } from 'convex/_generated/dataModel'

export type CategorySearch = {
  folderId?: Id<'folders'>
}

export const validateSearch = (
  search: Record<string, unknown>,
): CategorySearch | null => {
  if (!('folderId' in search) || !search.folderId) {
    return null
  }

  if (typeof search.folderId !== 'string') {
    return null
  }

  if (search.folderId.trim().length === 0) {
    return null
  }

  return { folderId: search.folderId as Id<'folders'> }
}
