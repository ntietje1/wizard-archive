import { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type {
  CollaborationUser,
  NoteSession,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'

type ReadonlyYjsSession = NoteSession &
  Readonly<{
    applyProjection(version: VersionStamp, replace: () => void): void
  }>

export function createReadonlyYjsSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  user: CollaborationUser,
): ReadonlyYjsSession {
  const awareness = new Awareness(document)
  let disposed = false
  let version = initialVersion
  return {
    document,
    get version() {
      return version
    },
    awareness: { status: 'unavailable' },
    collaboration: { provider: { awareness }, user },
    applyProjection(nextVersion, replace) {
      if (disposed) throw new TypeError('Readonly session is disposed')
      replace()
      version = nextVersion
    },
    flush: () =>
      Promise.resolve(
        disposed
          ? { status: 'rejected' as const, reason: 'scope_unavailable' as const }
          : { status: 'completed' as const, version },
      ),
    dispose() {
      if (disposed) return
      disposed = true
      awareness.destroy()
      document.destroy()
    },
  }
}

export function isReadonlyYjsSession(session: NoteSession): session is ReadonlyYjsSession {
  return 'applyProjection' in session
}
