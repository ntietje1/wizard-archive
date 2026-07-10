import type { Doc } from 'yjs'
import type { YjsCollaborationProvider } from '../collaboration/yjs-provider'

type NoteCollaborationSessionMode = 'editable' | 'readonly'

interface NoteCollaborationEngine {
  doc: Doc
  provider: YjsCollaborationProvider
}

interface NoteEditorSessionBase {
  instanceId: string | number
  mode: NoteCollaborationSessionMode
  user: {
    color: string
    name: string
  }
}

export type NoteEditorSession =
  | (NoteEditorSessionBase & { status: 'loading' })
  | (NoteEditorSessionBase & { status: 'error'; error: Error })
  | (NoteEditorSessionBase & {
      status: 'unavailable'
      reason: 'missing_collaboration_engine' | 'optimistic_resource_pending'
    })
  | (NoteEditorSessionBase & {
      status: 'ready'
      engine: NoteCollaborationEngine
      updateUser?: (user: { color: string; name: string }) => void
    })
