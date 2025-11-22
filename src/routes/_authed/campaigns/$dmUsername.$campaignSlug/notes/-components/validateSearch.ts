import type { Id } from 'convex/_generated/dataModel'

export type NotesSearch = {
  categorySlug?: string
  folderId?: Id<'folders'>
  mapId?: Id<'gameMaps'>
  noteSlug?: string
}

export const validateSearch = (
  search: Record<string, unknown>,
): NotesSearch => {
  const result: NotesSearch = {}

  if ('categorySlug' in search && typeof search.categorySlug === 'string' && search.categorySlug.trim().length > 0) {
    result.categorySlug = search.categorySlug
  }

  if ('folderId' in search && typeof search.folderId === 'string' && search.folderId.trim().length > 0) {
    result.folderId = search.folderId as Id<'folders'>
  }

  if ('mapId' in search && typeof search.mapId === 'string' && search.mapId.trim().length > 0) {
    result.mapId = search.mapId as Id<'gameMaps'>
  }

  if ('noteSlug' in search && typeof search.noteSlug === 'string' && search.noteSlug.trim().length > 0) {
    result.noteSlug = search.noteSlug
  }

  return result
}

