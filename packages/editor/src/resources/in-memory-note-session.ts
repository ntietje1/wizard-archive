import * as Y from 'yjs'
import type { ContentSessionSaveResult, NoteSession } from './content-session-contract'
import { advanceNoteContentVersion } from './resource-content-version'
import type { VersionStamp } from './component-version'
import { createInMemoryYjsSession } from './in-memory-yjs-session'

export function createInMemoryNoteSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  changed: (session: NoteSession) => void = () => {},
): NoteSession {
  return createInMemoryYjsSession(
    document,
    initialVersion,
    async (version): Promise<ContentSessionSaveResult> => ({
      status: 'completed',
      version: await advanceNoteContentVersion(version, Y.encodeStateAsUpdate(document)),
    }),
    changed,
  )
}
