import { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type {
  CollaborationUser,
  NoteSession,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { YjsSessionSurface } from './live-resource-content-authority'

export type ReadonlyYjsSession = NoteSession &
  Readonly<{
    applyProjection(version: VersionStamp, replace: () => void): void
    detach(): YjsSessionSurface
  }>

export function createReadonlyYjsSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  user: CollaborationUser,
  existingCollaboration?: NoteSession['collaboration'],
): ReadonlyYjsSession {
  const collaboration = existingCollaboration ?? {
    provider: { awareness: new Awareness(document) },
    user,
  }
  const awareness = collaboration.provider.awareness
  let disposed = false
  let leases = 0
  let transferred = false
  let version = initialVersion
  const destroy = () => {
    if (!disposed || leases > 0 || transferred) return
    awareness.destroy()
    document.destroy()
  }
  return {
    document,
    get version() {
      return version
    },
    awareness: { status: 'unavailable' },
    collaboration,
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
    retain() {
      if (disposed) throw new TypeError('Readonly session is disposed')
      leases += 1
      let retained = true
      return () => {
        if (!retained) return
        retained = false
        leases -= 1
        destroy()
      }
    },
    detach() {
      if (disposed) throw new TypeError('Readonly session is disposed')
      disposed = true
      transferred = true
      return {
        collaboration,
        document,
        release() {
          transferred = false
          destroy()
        },
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      destroy()
    },
  }
}

export function isReadonlyYjsSession(session: NoteSession): session is ReadonlyYjsSession {
  return 'applyProjection' in session
}
