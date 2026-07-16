import type { NoteBlock } from '../notes/document/model'
import { noteBlocksPlainText } from '../notes/document/plain-text'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../notes/document/headless-yjs'
import type { NoteSessionSource } from './content-session-contract'
import type { CampaignId, ResourceId } from './domain-id'
import type { ResourceBookmarkGateway, WorkspaceSearch } from './editor-runtime-contract'
import type { CommandDelivery, ResourceBookmarkCommandResult } from './resource-command-contract'
import type { ResourceRecord } from './resource-record'
import { ResourceSearchIndex } from './resource-search-index'
import { createResourceSearchDocument } from './resource-search-policy'

export function createInMemoryBookmarks(
  campaignId: CampaignId,
  resourceExists: (resourceId: ResourceId) => boolean,
): ResourceBookmarkGateway {
  let bookmarked = new Set<ResourceId>()
  let snapshot = { state: 'known' as const, value: bookmarked as ReadonlySet<ResourceId> }
  const listeners = new Set<() => void>()
  return {
    get: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    execute: (envelope): Promise<CommandDelivery<ResourceBookmarkCommandResult>> => {
      const resourceIds = Array.from(new Set(envelope.command.resourceIds))
      if (envelope.campaignId !== campaignId) {
        return Promise.resolve({
          status: 'received',
          result: { status: 'unavailable', reason: 'scope_unavailable' },
        })
      }
      if (resourceIds.some((resourceId) => !resourceExists(resourceId))) {
        return Promise.resolve({
          status: 'received',
          result: { status: 'rejected', reason: 'resource_missing' },
        })
      }
      const next = new Set(bookmarked)
      for (const resourceId of resourceIds) {
        if (envelope.command.bookmarked) next.add(resourceId)
        else next.delete(resourceId)
      }
      bookmarked = next
      snapshot = { state: 'known', value: bookmarked }
      for (const listener of listeners) listener()
      return Promise.resolve({
        status: 'received',
        result: {
          status: 'completed',
          receipt: {
            campaignId,
            operationId: envelope.operationId,
            resourceIds,
            bookmarked: envelope.command.bookmarked,
          },
        },
      })
    },
  }
}

export function createInMemoryWorkspaceSearch(
  resources: () => ReadonlyArray<ResourceRecord>,
  subscribeResources: (listener: () => void) => () => void,
  notes: NoteSessionSource,
): Readonly<{ gateway: WorkspaceSearch; dispose(): void }> {
  let recent: ReadonlyArray<ResourceId> = []
  const listeners = new Set<() => void>()
  const documents = new ResourceSearchIndex()
  const noteSubscriptions = new Map<ResourceId, () => void>()
  let resourcesById = new Map<ResourceId, ResourceRecord>()

  const refreshNote = (resourceId: ResourceId) => {
    const resource = resourcesById.get(resourceId)
    if (!resource || resource.kind !== 'note' || resource.lifecycle.state !== 'active') return
    documents.set(
      createResourceSearchDocument(resourceId, resource.title, noteBody(notes, resourceId)),
    )
  }
  const refreshResources = () => {
    resourcesById = new Map(resources().map((resource) => [resource.id, resource]))
    for (const resource of resourcesById.values()) {
      if (resource.lifecycle.state !== 'active') {
        documents.delete(resource.id)
        noteSubscriptions.get(resource.id)?.()
        noteSubscriptions.delete(resource.id)
        continue
      }
      const existing = documents.get(resource.id)
      documents.set(
        createResourceSearchDocument(
          resource.id,
          resource.title,
          resource.kind === 'note' ? (existing?.body ?? noteBody(notes, resource.id)) : '',
        ),
      )
      if (resource.kind === 'note' && !noteSubscriptions.has(resource.id)) {
        noteSubscriptions.set(
          resource.id,
          notes.subscribe(resource.id, () => refreshNote(resource.id)),
        )
      }
    }
    for (const resourceId of Array.from(documents.ids())) {
      if (resourcesById.has(resourceId)) continue
      documents.delete(resourceId)
      noteSubscriptions.get(resourceId)?.()
      noteSubscriptions.delete(resourceId)
    }
  }
  refreshResources()
  const unsubscribeResources = subscribeResources(refreshResources)

  const gateway: WorkspaceSearch = {
    search: (query) => documents.search(query),
    recent: () => recent,
    subscribeRecent: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    recordOpened: (resourceId) => {
      recent = [resourceId, ...recent.filter((candidate) => candidate !== resourceId)].slice(0, 100)
      for (const listener of listeners) listener()
    },
  }
  return {
    gateway,
    dispose: () => {
      unsubscribeResources()
      for (const unsubscribe of noteSubscriptions.values()) unsubscribe()
      noteSubscriptions.clear()
      documents.clear()
      listeners.clear()
    },
  }
}

function noteBody(notes: NoteSessionSource, resourceId: ResourceId): string {
  const state = notes.get(resourceId)
  if (state.status !== 'ready') return ''
  let blocks: ReadonlyArray<NoteBlock>
  try {
    blocks = noteYDocToBlocks(state.session.document, NOTE_YJS_FRAGMENT)
  } catch {
    return ''
  }
  return noteBlocksPlainText(blocks)
}
