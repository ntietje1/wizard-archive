import { api } from 'convex/_generated/api'
import { useLinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useNoteYjsCollaboration } from '~/features/editor/hooks/useNoteYjsCollaboration'
import { getCursorColor } from '~/features/editor/utils/cursor-colors'
import { useLiveNoteValueRuntimeSource } from '~/features/editor/value-block/use-live-note-value-runtime-source'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { updateConvexYjsProviderUser } from '~/shared/collaboration/convex-yjs-provider'
import type {
  EditorWorkspaceNoteDocuments,
  EditorWorkspaceNoteEditableSessionProviderProps,
  EditorWorkspaceNoteRuntimeProviderProps,
} from './editor-workspace-source'

export const LIVE_EDITOR_WORKSPACE_NOTE_DOCUMENTS: EditorWorkspaceNoteDocuments = {
  EditableSessionProvider: LiveEditableNoteSessionProvider,
  RuntimeProvider: LiveNoteRuntimeProvider,
}

function LiveEditableNoteSessionProvider({
  children,
  note,
}: EditorWorkspaceNoteEditableSessionProviderProps) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const user = {
    name: profile?.name ?? profile?.username ?? 'Anonymous',
    color: profile ? getCursorColor(profile._id) : '#61afef',
  }
  const session = useNoteYjsCollaboration(note._id, user, true)

  return children({
    destroy: () => {},
    doc: session.doc,
    error: session.error,
    instanceId: session.instanceId,
    isLoading: session.isLoading,
    provider: session.provider,
    updateUser: (nextUser) => {
      if (session.provider) {
        updateConvexYjsProviderUser(session.provider, nextUser)
      }
    },
    user,
  })
}

function LiveNoteRuntimeProvider({
  children,
  editor,
  isViewerMode,
  noteId,
}: EditorWorkspaceNoteRuntimeProviderProps) {
  const linkResolver = useLinkResolver(noteId, { isViewerMode })
  const valueRuntimeSource = useLiveNoteValueRuntimeSource({ editor, noteId })

  return children({ linkResolver, valueRuntimeSource })
}
