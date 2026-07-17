import type { NoteBlock } from '../notes/document/model'
import { noteBlocksPlainText } from '../notes/document/plain-text'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../notes/document/headless-yjs'
import type { NoteSessionSource } from './content-session-contract'
import type { CampaignId, ResourceId } from './domain-id'
import type { ResourceBookmarkGateway, WorkspaceSearch } from './editor-runtime-contract'
import type { CommandDelivery, ResourceBookmarkCommandResult } from './resource-command-contract'
import type { ResourceRecord } from './resource-record'
import {
  createResourceSearchDocument,
  executeResourceSearchPlan,
  normalizeResourceSearchText,
  searchResourceDocuments,
} from './resource-search-policy'
import type {
  ResourceSearchDocument,
  ResourceSearchPage,
  ResourceSearchProvider,
} from './resource-search-policy'

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
  notes: NoteSessionSource,
): Readonly<{ gateway: WorkspaceSearch; dispose(): void }> {
  let recent: ReadonlyArray<ResourceId> = []
  const listeners = new Set<() => void>()

  const gateway: WorkspaceSearch = {
    search: (query) =>
      executeResourceSearchPlan(
        query,
        createSnapshotSearchProvider(searchDocuments(resources(), notes)),
      ),
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
      listeners.clear()
    },
  }
}

function createSnapshotSearchProvider(
  documents: ReadonlyArray<ResourceSearchDocument>,
): ResourceSearchProvider {
  return {
    titlePrefix: (normalized, limit) => ({
      documents: documents
        .filter((document) => normalizeResourceSearchText(document.title).startsWith(normalized))
        .sort(compareSearchDocuments)
        .slice(0, limit)
        .map(withoutBody),
      complete: true,
    }),
    titleMatches: (normalized, limit) => searchPage(documents, normalized, limit, withoutBody),
    bodyMatches: (normalized, limit) => searchPage(documents, normalized, limit, withoutTitle),
  }
}

function searchPage(
  documents: ReadonlyArray<ResourceSearchDocument>,
  normalized: string,
  limit: number,
  searchablePart: (document: ResourceSearchDocument) => ResourceSearchDocument,
): ResourceSearchPage {
  const matches = documents.filter(
    (document) => searchResourceDocuments([searchablePart(document)], normalized).length > 0,
  )
  return { documents: matches.slice(0, limit), complete: matches.length <= limit }
}

function withoutBody(document: ResourceSearchDocument): ResourceSearchDocument {
  return { ...document, body: '' }
}

function withoutTitle(document: ResourceSearchDocument): ResourceSearchDocument {
  return { ...document, title: '' }
}

function compareSearchDocuments(
  left: ResourceSearchDocument,
  right: ResourceSearchDocument,
): number {
  const leftTitle = normalizeResourceSearchText(left.title)
  const rightTitle = normalizeResourceSearchText(right.title)
  return compareText(leftTitle, rightTitle) || compareText(left.resourceId, right.resourceId)
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function searchDocuments(resources: ReadonlyArray<ResourceRecord>, notes: NoteSessionSource) {
  return resources.flatMap((resource) =>
    resource.lifecycle.state === 'active'
      ? [
          createResourceSearchDocument(
            resource.id,
            resource.title,
            resource.kind === 'note' ? noteBody(notes, resource.id) : '',
          ),
        ]
      : [],
  )
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
