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
  project: (resourceIds: ReadonlyArray<ResourceId>) => Promise<void>,
): Readonly<{ gateway: WorkspaceSearch; dispose(): void }> {
  let recent: ReadonlyArray<ResourceId> = []
  const listeners = new Set<() => void>()

  const gateway: WorkspaceSearch = {
    search: async (query) => {
      const outcome = await executeResourceSearchPlan(
        query,
        createSnapshotSearchProvider(activeResources(resources()), notes),
      )
      await project(outcome.results.map((result) => result.resourceId))
      return outcome
    },
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
  resources: ReadonlyArray<ResourceRecord>,
  notes: NoteSessionSource,
): ResourceSearchProvider {
  const titleDocuments = resources.map(titleSearchDocument)
  return {
    titlePrefix: (normalized, limit) => ({
      documents: titleDocuments
        .filter((document) => normalizeResourceSearchText(document.title).startsWith(normalized))
        .sort(compareSearchDocuments)
        .slice(0, limit),
      complete: true,
    }),
    titleMatches: (normalized, limit) => searchPage(titleDocuments, normalized, limit),
    bodyMatches: (normalized, limit) => bodySearchPage(resources, notes, normalized, limit),
  }
}

function searchPage(
  documents: ReadonlyArray<ResourceSearchDocument>,
  normalized: string,
  limit: number,
): ResourceSearchPage {
  const matches = documents.filter(
    (document) => searchResourceDocuments([document], normalized).length > 0,
  )
  return { documents: matches.slice(0, limit), complete: matches.length <= limit }
}

function bodySearchPage(
  resources: ReadonlyArray<ResourceRecord>,
  notes: NoteSessionSource,
  normalized: string,
  limit: number,
): ResourceSearchPage {
  const candidates = resources.filter((resource) => resource.kind === 'note')
  const documents = candidates
    .slice(0, limit)
    .map((resource) => createResourceSearchDocument(resource.id, '', noteBody(notes, resource.id)))
  return {
    documents: documents.filter(
      (document) => searchResourceDocuments([document], normalized).length > 0,
    ),
    complete: candidates.length <= limit,
  }
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

function activeResources(resources: ReadonlyArray<ResourceRecord>) {
  return resources.filter((resource) => resource.lifecycle.state === 'active')
}

function titleSearchDocument(resource: ResourceRecord): ResourceSearchDocument {
  return createResourceSearchDocument(resource.id, resource.title, '')
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
