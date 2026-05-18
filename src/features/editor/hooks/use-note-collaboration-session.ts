import { api } from 'convex/_generated/api'
import { useNoteYjsCollaboration } from './useNoteYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useNoteCollaborationSession({
  noteId,
  canEdit,
}: {
  noteId: Id<'sidebarItems'>
  canEdit: boolean
}) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const user = {
    name: profile?.name ?? profile?.username ?? 'Anonymous',
    color: profile ? getCursorColor(profile._id) : '#61afef',
  }
  const session = useNoteYjsCollaboration(noteId, user, canEdit)

  return {
    ...session,
    user,
  }
}
