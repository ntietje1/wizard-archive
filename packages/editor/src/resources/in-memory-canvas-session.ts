import * as Y from 'yjs'
import { canonicalizeCanvasDocumentContent } from '../canvas/document-contract'
import { advanceVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import type { CanvasSession, ContentSessionSaveResult } from './content-session-contract'
import { canvasEncodedBytesWithinWorkload } from '../canvas/workload'
import { createInMemoryYjsSession } from './in-memory-yjs-session'

export function createInMemoryCanvasSession(
  document: Y.Doc,
  initialVersion: VersionStamp,
  changed: (session: CanvasSession) => void = () => {},
): CanvasSession {
  return createInMemoryYjsSession(
    document,
    initialVersion,
    async (version): Promise<ContentSessionSaveResult> => {
      if (!canvasEncodedBytesWithinWorkload(Y.encodeStateAsUpdate(document))) {
        return { status: 'rejected', reason: 'content_limit_exceeded' }
      }
      if (!canonicalizeCanvasDocumentContent(document)) {
        return { status: 'rejected', reason: 'content_corrupt' }
      }
      try {
        const update = Y.encodeStateAsUpdate(document)
        if (!canvasEncodedBytesWithinWorkload(update)) {
          return { status: 'rejected', reason: 'content_limit_exceeded' }
        }
        return { status: 'completed', version: advanceVersion(version, await sha256Digest(update)) }
      } catch (error) {
        return {
          status: 'rejected',
          reason: error instanceof RangeError ? 'version_exhausted' : 'content_corrupt',
        }
      }
    },
    changed,
  )
}
