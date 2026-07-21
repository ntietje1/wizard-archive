import type * as Y from 'yjs'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../notes/document/headless-yjs'
import { projectedNoteOutline } from '../notes/document/outline'
import type { NoteOutlineSource, NoteOutlineState } from '../notes/document/outline'
import type { ResourceId } from './domain-id'

const UNAVAILABLE: NoteOutlineState = { status: 'unavailable', reason: 'unauthorized' }

export function createInMemoryNoteOutlineSource(
  notes: ReadonlyArray<Readonly<{ resourceId: ResourceId; content: Y.Doc }>>,
): Readonly<{ source: NoteOutlineSource; dispose(): void }> {
  const documents = new Map(notes.map((note) => [note.resourceId, note.content]))
  const listeners = new Map<ResourceId, Set<() => void>>()
  const updates = new Map<ResourceId, () => void>()
  const get = (resourceId: ResourceId) => noteOutlineState(documents.get(resourceId))
  const subscribe = (resourceId: ResourceId, listener: () => void) => {
    const subscribers = listeners.get(resourceId) ?? new Set()
    subscribers.add(listener)
    listeners.set(resourceId, subscribers)
    const document = documents.get(resourceId)
    if (document && !updates.has(resourceId)) {
      const update = () => {
        for (const subscriber of listeners.get(resourceId) ?? []) subscriber()
      }
      document.on('update', update)
      updates.set(resourceId, () => document.off('update', update))
    }
    return () => {
      const current = listeners.get(resourceId)
      current?.delete(listener)
      if (current && current.size > 0) return
      listeners.delete(resourceId)
      updates.get(resourceId)?.()
      updates.delete(resourceId)
    }
  }
  return {
    source: { get, subscribe },
    dispose: () => {
      for (const release of updates.values()) release()
      updates.clear()
      listeners.clear()
    },
  }
}

function noteOutlineState(document: Y.Doc | undefined): NoteOutlineState {
  if (!document) return UNAVAILABLE
  try {
    return {
      status: 'ready',
      headings: projectedNoteOutline(noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)),
    }
  } catch {
    return { status: 'unavailable', reason: 'integrity_error' }
  }
}
