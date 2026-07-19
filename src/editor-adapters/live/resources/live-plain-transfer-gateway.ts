import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import {
  planPlainTransfer,
  plainTransferEntryIdentities,
} from '@wizard-archive/editor/resources/plain-transfer-inventory'
import type { PlainTransferInventoryResource } from '@wizard-archive/editor/resources/plain-transfer-inventory'
import type {
  PlainTransferGateway,
  PlainTransferExecutionResult,
  PlainTransferInputEntry,
  PlainTransferProgress,
} from '@wizard-archive/editor/resources/transfer-job-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ImportJobId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { FileResourceSource } from '@wizard-archive/editor/resources/content-session-contract'
import { markdownToNoteYDoc } from '@wizard-archive/editor/notes/document-yjs'
import * as Y from 'yjs'

type ExecuteArgs = FunctionArgs<typeof api.resources.actions.executePlainTransfer>
type ExecuteResult = FunctionReturnType<typeof api.resources.actions.executePlainTransfer>
type CancelArgs = FunctionArgs<typeof api.resources.mutations.cancelPlainTransfer>

type LivePlainTransferBackend = Readonly<{
  cancel(args: CancelArgs): Promise<void>
  discard(sessionId: Id<'fileStorage'>): Promise<void>
  execute(args: ExecuteArgs): Promise<ExecuteResult>
  refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
  upload(source: FileResourceSource): Promise<Id<'fileStorage'>>
}>

type PendingPlainTransfer = Readonly<{
  sourceDigest: string
  sessions: ReadonlyMap<string, Id<'fileStorage'>>
}>

export function createLivePlainTransferGateway(
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  backend: LivePlainTransferBackend,
): PlainTransferGateway {
  const pending = new Map<ImportJobId, PendingPlainTransfer>()
  return {
    execute: async (intent, sources, entries, options) => {
      if (options?.signal?.aborted) return { status: 'cancelled' }
      const planned = await planPlainTransfer({
        campaignId,
        actorId,
        intent,
        sources,
        entries,
      })
      if (planned.status === 'rejected') {
        return { status: 'rejected', reason: planned.reason }
      }
      const request = planned.inventory.request
      const noteUpdates = prepareNoteUpdates(planned.inventory.resources)
      const existing = pending.get(intent.jobId)
      if (existing && existing.sourceDigest !== request.sourceDigest) {
        return { status: 'rejected', reason: 'source_changed' }
      }
      let current = existing
      const cancel = () => {
        void backend
          .cancel({
            campaignId,
            jobId: intent.jobId,
            operationId: intent.operationId,
            destinationParentId: intent.destinationParentId,
            sourceDigest: request.sourceDigest,
            entries: [...plainTransferEntryIdentities(planned.inventory.resources)],
          })
          .catch(() => undefined)
      }
      options?.signal?.addEventListener('abort', cancel, { once: true })
      try {
        if (!current) {
          current = {
            sourceDigest: request.sourceDigest,
            sessions: await uploadPlainTransferEntries(backend, entries, options?.onProgress),
          }
          pending.set(intent.jobId, current)
        }
        const transfer = current
        if (options?.signal?.aborted) {
          pending.delete(intent.jobId)
          await discardSessions(backend, transfer.sessions)
          return { status: 'cancelled' }
        }
        const result = await backend.execute({
          campaignId,
          jobId: intent.jobId,
          operationId: intent.operationId,
          destinationParentId: intent.destinationParentId,
          sources: [...sources],
          entries: entries.map((entry) => liveTransferEntry(entry, transfer.sessions, noteUpdates)),
        })
        if (result.status === 'indeterminate') return result
        pending.delete(intent.jobId)
        await discardSessions(backend, transfer.sessions)
        if (result.status !== 'completed') return result
        const completed = await completeLivePlainTransfer(
          planned.inventory.resources,
          result,
          backend,
        )
        if (completed.status !== 'completed') return completed
        options?.onProgress?.({
          completedEntries: completed.entries.length,
          totalEntries: completed.entries.length,
          uploadedBytes: totalFileBytes(entries),
          totalBytes: totalFileBytes(entries),
          currentPath: null,
        })
        return completed
      } catch {
        return { status: 'indeterminate', reason: 'response_lost' }
      } finally {
        options?.signal?.removeEventListener('abort', cancel)
      }
    },
  }
}

async function completeLivePlainTransfer(
  planned: ReadonlyArray<PlainTransferInventoryResource>,
  result: Extract<ExecuteResult, { status: 'completed' }>,
  backend: Pick<LivePlainTransferBackend, 'refresh'>,
): Promise<PlainTransferExecutionResult> {
  const resources = new Map(planned.map((resource) => [resource.id, resource]))
  const resourcesBySource = new Map(
    planned.map((resource) => [
      transferEntryKey({
        sourceId: resource.alias.sourceRootId,
        path: resource.sourcePath,
      }),
      resource,
    ]),
  )
  const entries = result.entries.map((entry) =>
    entry.status === 'rejected'
      ? entry
      : {
          ...entry,
          resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceId),
        },
  )
  if (entries.length !== resourcesBySource.size) {
    return { status: 'rejected', reason: 'invalid_response' }
  }
  const receivedSources = new Set<string>()
  for (const entry of entries) {
    const source = transferEntryKey({
      sourceId: entry.sourceId,
      path: entry.sourcePath,
    })
    const expected = resourcesBySource.get(source)
    if (
      !expected ||
      receivedSources.has(source) ||
      (entry.status === 'completed' &&
        (entry.resourceId !== expected.id || entry.kind !== expected.kind))
    ) {
      return { status: 'rejected', reason: 'invalid_response' }
    }
    receivedSources.add(source)
  }
  await Promise.all(
    entries.flatMap((entry) => {
      if (entry.status !== 'completed') return []
      const resource = resources.get(entry.resourceId)
      return resource ? [backend.refresh(resource.id, resource.parentId)] : []
    }),
  )
  return { status: 'completed', entries }
}

async function uploadPlainTransferEntries(
  backend: Pick<LivePlainTransferBackend, 'discard' | 'upload'>,
  entries: ReadonlyArray<PlainTransferInputEntry>,
  onProgress: ((progress: PlainTransferProgress) => void) | undefined,
): Promise<ReadonlyMap<string, Id<'fileStorage'>>> {
  const sessions = new Map<string, Id<'fileStorage'>>()
  const fileEntries = entries.filter(
    (entry): entry is Extract<PlainTransferInputEntry, { type: 'file' }> => entry.type === 'file',
  )
  const totalBytes = totalFileBytes(entries)
  let uploadedBytes = 0
  try {
    for (const [index, entry] of fileEntries.entries()) {
      onProgress?.({
        completedEntries: index,
        totalEntries: entries.length,
        uploadedBytes,
        totalBytes,
        currentPath: entry.path,
      })
      const sessionId = await backend.upload({
        bytes: entry.bytes,
        fileName: entry.path.slice(entry.path.lastIndexOf('/') + 1),
      })
      sessions.set(transferEntryKey(entry), sessionId)
      uploadedBytes += entry.bytes.byteLength
    }
    return sessions
  } catch (error) {
    await discardSessions(backend, sessions)
    throw error
  }
}

async function discardSessions(
  backend: Pick<LivePlainTransferBackend, 'discard'>,
  sessions: ReadonlyMap<string, Id<'fileStorage'>>,
): Promise<void> {
  await Promise.all(
    [...sessions.values()].map((sessionId) => backend.discard(sessionId).catch(() => undefined)),
  )
}

function totalFileBytes(entries: ReadonlyArray<PlainTransferInputEntry>): number {
  return entries.reduce(
    (total, entry) => total + (entry.type === 'file' ? entry.bytes.byteLength : 0),
    0,
  )
}

function transferEntryKey(entry: Pick<PlainTransferInputEntry, 'sourceId' | 'path'>): string {
  return `${entry.sourceId}\0${entry.path}`
}

function requireUploadSession(
  sessions: ReadonlyMap<string, Id<'fileStorage'>>,
  entry: Pick<PlainTransferInputEntry, 'sourceId' | 'path'>,
): Id<'fileStorage'> {
  const session = sessions.get(transferEntryKey(entry))
  if (!session) throw new TypeError(`Upload session is unavailable for ${entry.path}`)
  return session
}

function liveTransferEntry(
  entry: PlainTransferInputEntry,
  sessions: ReadonlyMap<string, Id<'fileStorage'>>,
  noteUpdates: ReadonlyMap<string, ArrayBuffer>,
): ExecuteArgs['entries'][number] {
  if (entry.type === 'directory') return entry
  const noteUpdate = noteUpdates.get(transferEntryKey(entry))
  return {
    sourceId: entry.sourceId,
    path: entry.path,
    type: 'file',
    uploadSessionId: requireUploadSession(sessions, entry),
    ...(noteUpdate ? { noteUpdate } : {}),
  }
}

function prepareNoteUpdates(
  resources: ReadonlyArray<PlainTransferInventoryResource>,
): ReadonlyMap<string, ArrayBuffer> {
  const updates = new Map<string, ArrayBuffer>()
  for (const resource of resources) {
    if (resource.kind !== 'note') continue
    const document = markdownToNoteYDoc(resource.content.source.text)
    try {
      updates.set(
        transferEntryKey({
          sourceId: resource.alias.sourceRootId,
          path: resource.sourceEntryPath,
        }),
        Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer,
      )
    } finally {
      document.destroy()
    }
  }
  return updates
}
