import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import type { NoteSession, NoteSessionSaveResult } from './content-session-contract'
import { advanceNoteContentVersion } from './resource-content-version'
import type { VersionStamp } from './component-version'

export function createInMemoryNoteSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  readonly: boolean,
  changed: (session: NoteSession) => void = () => {},
): NoteSession {
  let version = initialVersion
  let dirty = false
  let disposed = false

  const onUpdate = () => {
    if (!disposed) dirty = true
  }
  document.on('update', onUpdate)
  const collaborationAwareness = new Awareness(document)
  const collaboration = {
    provider: { awareness: collaborationAwareness },
    user: { name: 'You', color: '#5e6ad2' },
  }
  collaborationAwareness.setLocalStateField('user', collaboration.user)

  const session: NoteSession = {
    document,
    get version() {
      return version
    },
    awareness: { status: 'unavailable' },
    collaboration,
    readonly,
    async flush(): Promise<NoteSessionSaveResult> {
      if (disposed) return { status: 'rejected', reason: 'scope_unavailable' }
      if (dirty) {
        version = await advanceNoteContentVersion(version, Y.encodeStateAsUpdate(document))
        dirty = false
        changed(session)
      }
      return { status: 'completed', version }
    },
    dispose() {
      if (disposed) return
      document.off('update', onUpdate)
      disposed = true
      collaborationAwareness.destroy()
      document.destroy()
    },
  }
  return session
}
