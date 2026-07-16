import { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type { VersionStamp } from './component-version'
import type { ContentSessionSaveResult, NoteSession } from './content-session-contract'

export function createInMemoryYjsSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  persist: (version: VersionStamp) => Promise<ContentSessionSaveResult>,
  changed: (session: NoteSession) => void,
): NoteSession {
  let version = initialVersion
  let revision = 0
  let persistedRevision = 0
  let disposed = false
  const onUpdate = () => {
    if (!disposed) revision += 1
  }
  document.on('update', onUpdate)

  const awareness = new Awareness(document)
  const collaboration = {
    provider: { awareness },
    user: { name: 'You', color: '#5e6ad2' },
  }
  awareness.setLocalStateField('user', collaboration.user)

  const session: NoteSession = {
    document,
    get version() {
      return version
    },
    awareness: { status: 'unavailable' as const },
    collaboration,
    async flush(): Promise<ContentSessionSaveResult> {
      if (disposed) return { status: 'rejected', reason: 'scope_unavailable' }
      if (revision === persistedRevision) return { status: 'completed', version }

      const savingRevision = revision
      const result = await persist(version)
      if (result.status === 'completed') {
        version = result.version
        persistedRevision = savingRevision
        changed(session)
      }
      return result
    },
    dispose() {
      if (disposed) return
      document.off('update', onUpdate)
      disposed = true
      awareness.destroy()
      document.destroy()
    },
  }
  return session
}
