import * as Y from 'yjs'
import { canonicalizeCanvasDocumentContent } from '../canvas/document-contract'
import { advanceVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import type { CanvasSession, ContentSessionSaveResult } from './content-session-contract'

export function createInMemoryCanvasSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  changed: (session: CanvasSession) => void = () => {},
): CanvasSession {
  let version = initialVersion
  let dirty = false
  let disposed = false

  const onUpdate = () => {
    if (!disposed) dirty = true
  }
  document.on('update', onUpdate)

  const session: CanvasSession = {
    document,
    get version() {
      return version
    },
    awareness: { status: 'unavailable' },
    async flush(): Promise<ContentSessionSaveResult> {
      if (disposed) return { status: 'rejected', reason: 'scope_unavailable' }
      if (!dirty) return { status: 'completed', version }
      if (!canonicalizeCanvasDocumentContent(document)) {
        return { status: 'rejected', reason: 'content_corrupt' }
      }
      try {
        const update = Y.encodeStateAsUpdate(document)
        version = advanceVersion(version, await sha256Digest(update))
        dirty = false
        changed(session)
        return { status: 'completed', version }
      } catch (error) {
        return {
          status: 'rejected',
          reason: error instanceof RangeError ? 'version_exhausted' : 'content_corrupt',
        }
      }
    },
    dispose() {
      if (disposed) return
      document.off('update', onUpdate)
      disposed = true
      document.destroy()
    },
  }
  return session
}
