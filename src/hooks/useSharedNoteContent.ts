import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

export function useSharedNoteContent(
  noteId: Id<'notes'>,
  playerId?: Id<'campaignMembers'>,
) {
  const sharedNoteQuery = useQuery({
    ...convexQuery(api.notes.queries.getNoteWithSharedContent, {
      noteId,
      playerId,
    }),
  })

  return {
    sharedNoteQuery,
  }
}
