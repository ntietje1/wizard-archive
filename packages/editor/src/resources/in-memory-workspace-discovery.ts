import type { NoteBlock } from '../notes/document/model'
import { noteBlocksPlainText } from '../notes/document/plain-text'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../notes/document/headless-yjs'
import type { NoteSessionSource } from './content-session-contract'
import type { CampaignId, ResourceId } from './domain-id'
import type {
  ResourceBookmarkGateway,
  WorkspaceSearch,
  WorkspaceSearchResult,
} from './editor-runtime-contract'
import type { CommandDelivery, ResourceBookmarkCommandResult } from './resource-command-contract'
import type { ResourceRecord } from './resource-record'

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
): WorkspaceSearch {
  let recent: ReadonlyArray<ResourceId> = []
  const listeners = new Set<() => void>()
  return {
    search: (query) => Promise.resolve(searchResources(resources(), notes, query)),
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
}

function searchResources(
  resources: ReadonlyArray<ResourceRecord>,
  notes: NoteSessionSource,
  query: string,
): ReadonlyArray<WorkspaceSearchResult> {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []
  const titleMatches: Array<Readonly<{ result: WorkspaceSearchResult; score: number }>> = []
  const bodyMatches: Array<WorkspaceSearchResult> = []
  for (const resource of resources) {
    if (resource.lifecycle.state !== 'active') continue
    const titleMatch = matchResourceTitle(resource, normalized)
    if (titleMatch) {
      titleMatches.push(titleMatch)
      continue
    }
    const bodyMatch = matchNoteBody(resource, notes, normalized)
    if (bodyMatch) bodyMatches.push(bodyMatch)
  }
  titleMatches.sort(
    (left, right) =>
      right.score - left.score || left.result.resourceId.localeCompare(right.result.resourceId),
  )
  return [...titleMatches.map(({ result }) => result), ...bodyMatches]
}

function matchResourceTitle(
  resource: ResourceRecord,
  query: string,
): Readonly<{ result: WorkspaceSearchResult; score: number }> | null {
  const title = resource.title.toLocaleLowerCase()
  if (!title.includes(query)) return null
  return {
    result: { resourceId: resource.id, match: { type: 'title' } },
    score: title === query ? 3 : title.startsWith(query) ? 2 : 1,
  }
}

function matchNoteBody(
  resource: ResourceRecord,
  notes: NoteSessionSource,
  query: string,
): WorkspaceSearchResult | null {
  if (resource.kind !== 'note') return null
  const state = notes.get(resource.id)
  if (state.status !== 'ready') return null
  const text = noteText(state.session.document)
  const matchIndex = text.toLocaleLowerCase().indexOf(query)
  return matchIndex < 0
    ? null
    : {
        resourceId: resource.id,
        match: { type: 'body', text: searchExcerpt(text, matchIndex, query.length) },
      }
}

function noteText(document: Parameters<typeof noteYDocToBlocks>[0]): string {
  let blocks: ReadonlyArray<NoteBlock>
  try {
    blocks = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
  } catch {
    return ''
  }
  return noteBlocksPlainText(blocks)
}

function searchExcerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60)
  const end = Math.min(text.length, index + length + 100)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
