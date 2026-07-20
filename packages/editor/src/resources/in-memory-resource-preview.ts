import type * as Y from 'yjs'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../notes/document/headless-yjs'
import { noteBlocksPlainText } from '../notes/document/plain-text'
import { noteDocumentOutline } from '../notes/document/outline'
import type { ResourceId } from './domain-id'
import type { ResourcePreviewSource, ResourcePreviewState } from './editor-runtime-contract'
import { createResourcePreview } from './resource-preview'
import type { ResourceRecord } from './resource-record'

const UNAVAILABLE: ResourcePreviewState = { status: 'unavailable', reason: 'unauthorized' }

export function createInMemoryResourcePreviewSource(
  resources: ReadonlyArray<ResourceRecord>,
  notes: ReadonlyArray<Readonly<{ resourceId: ResourceId; content: Y.Doc }>>,
): Readonly<{ source: ResourcePreviewSource; dispose(): void }> {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
  const noteById = new Map(notes.map((note) => [note.resourceId, note.content]))
  const states = new Map(
    resources.map((resource) => [resource.id, previewState(resource, noteById.get(resource.id))]),
  )
  const listeners = new Map<ResourceId, Set<() => void>>()
  const updates = new Map<ResourceId, () => void>()

  const subscribe = (resourceId: ResourceId, listener: () => void) => {
    const current = listeners.get(resourceId) ?? new Set()
    current.add(listener)
    listeners.set(resourceId, current)
    const document = noteById.get(resourceId)
    if (document && !updates.has(resourceId)) {
      const update = () => {
        states.set(resourceId, previewState(resourceById.get(resourceId), document))
        for (const subscriber of listeners.get(resourceId) ?? []) subscriber()
      }
      document.on('update', update)
      updates.set(resourceId, () => document.off('update', update))
    }
    return () => {
      const subscribers = listeners.get(resourceId)
      subscribers?.delete(listener)
      if (subscribers && subscribers.size > 0) return
      listeners.delete(resourceId)
      updates.get(resourceId)?.()
      updates.delete(resourceId)
    }
  }

  return {
    source: {
      get: (resourceId) => states.get(resourceId) ?? UNAVAILABLE,
      subscribe,
    },
    dispose: () => {
      for (const release of updates.values()) release()
      updates.clear()
      listeners.clear()
    },
  }
}

function previewState(
  resource: ResourceRecord | undefined,
  note: Y.Doc | undefined,
): ResourcePreviewState {
  if (!resource || resource.lifecycle.state !== 'active') {
    return { status: 'unavailable', reason: 'unauthorized' }
  }
  if (resource.kind !== 'note') {
    return {
      status: 'ready',
      preview: createResourcePreview(resource.kind, '', []),
    }
  }
  if (!note) return { status: 'unavailable', reason: 'integrity_error' }
  try {
    const blocks = noteYDocToBlocks(note, NOTE_YJS_FRAGMENT)
    return {
      status: 'ready',
      preview: createResourcePreview(
        'note',
        noteBlocksPlainText(blocks),
        noteDocumentOutline(blocks),
      ),
    }
  } catch {
    return { status: 'unavailable', reason: 'integrity_error' }
  }
}
