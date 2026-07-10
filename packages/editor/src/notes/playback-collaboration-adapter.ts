import { Awareness } from 'y-protocols/awareness'
import { createNoteYDocFromContent } from './imported-text'
import type { Doc } from 'yjs'
import type { NoteBlock } from './document/model'
import type { YjsCollaborationProvider } from '../collaboration/yjs-provider'

interface DetachedNotePlaybackEngine {
  doc: Doc
  provider: YjsCollaborationProvider
  destroy: () => void
}

export function createDetachedNotePlaybackEngine(
  content: Array<NoteBlock>,
): DetachedNotePlaybackEngine {
  const doc = createNoteYDocFromContent(content)
  const provider = createDetachedNotePlaybackProvider(doc)

  return {
    doc,
    provider,
    destroy: () => {
      provider.destroy()
      doc.destroy()
    },
  }
}

function createDetachedNotePlaybackProvider(doc: Doc): YjsCollaborationProvider {
  const awareness = new Awareness(doc)
  const syncHandlers = new Set<(synced: boolean) => void>()
  return {
    awareness,
    doc,
    destroy: () => {
      syncHandlers.clear()
      awareness.destroy()
    },
    emit: (_name, [synced]) => {
      syncHandlers.forEach((handler) => handler(synced))
    },
    flushPendingUpdates: () => Promise.resolve(true),
    flushUpdates: () => Promise.resolve(),
    isApplyingRemoteUpdate: () => false,
    off: (_name, handler) => {
      syncHandlers.delete(handler)
    },
    on: (_name, handler) => {
      syncHandlers.add(handler)
    },
    updateUser: () => {},
  }
}
