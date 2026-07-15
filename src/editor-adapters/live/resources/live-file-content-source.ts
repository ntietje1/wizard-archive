import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import type {
  FileContentSource,
  FileResourceSource,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { classifyFileResourceSource } from '@wizard-archive/editor/resources/source-classifier'
import { normalizeResourceStructureCommand } from '@wizard-archive/editor/resources/command-protocol'
import type { ResourceHistoryRecording } from '@wizard-archive/editor/resources/undo-history'
import {
  createLiveResourceContentSource,
  finalizeLiveContentCreate,
} from './live-resource-content-source'
import type { LiveResourceContentBackend } from './live-resource-content-source'
import {
  deliverExpectedCreateResult,
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'

type CreateFileArgs = FunctionArgs<typeof api.resources.mutations.createFileResource>
type CreateFileResult = FunctionReturnType<typeof api.resources.mutations.createFileResource>
type FileDownloadResult = FunctionReturnType<typeof api.resources.queries.loadFileDownload>

type LiveFileContentBackend = LiveResourceContentBackend &
  Readonly<{
    create(args: CreateFileArgs): Promise<CreateFileResult>
    download(resourceId: ResourceId): Promise<FileDownloadResult>
    discard(sessionId: Id<'fileStorage'>): Promise<void>
    refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
    upload(source: FileResourceSource): Promise<Id<'fileStorage'>>
  }>

type PendingFileCreate = Readonly<{
  operationId: OperationId
  sessionId: Id<'fileStorage'>
  source: FileResourceSource
}>

function invalidCreateDelivery(): CommandDelivery<ResourceStructureCommandResult> {
  return { status: 'received', result: { status: 'rejected', reason: 'invalid_command' } }
}

export function createLiveFileContentSource(
  campaignId: CampaignId,
  backend: LiveFileContentBackend,
  beginCreate: () => ResourceHistoryRecording,
): FileContentSource {
  const content = createLiveResourceContentSource('file', backend)
  const pending = new Map<ResourceId, PendingFileCreate>()
  return {
    ...content,
    export: async (resourceId) => {
      const state = content.get(resourceId)
      if (state.status !== 'ready') {
        return state.status === 'initializing' ? { status: 'loading' } : state
      }
      const download = await backend.download(resourceId)
      if (download.status !== 'ready') return download
      const bytes =
        download.url === null
          ? new Uint8Array()
          : new Uint8Array(await (await fetchFile(download.url)).arrayBuffer())
      if (bytes.byteLength !== state.content.byteSize) {
        return { status: 'integrity_error', issue: 'content_corrupt' }
      }
      return {
        status: 'ready',
        bytes,
        extension: state.content.extension ?? 'bin',
        mediaType: state.content.mediaType,
      }
    },
    create: async (envelope, source) => {
      if (envelope.campaignId !== campaignId) return invalidCreateDelivery()
      const existing = pending.get(envelope.command.resourceId)
      if (
        existing &&
        (existing.operationId !== envelope.operationId || existing.source !== source)
      ) {
        return invalidCreateDelivery()
      }
      const metadata = classifyFileResourceSource(source)
      if (metadata.classification === 'rejected') return invalidCreateDelivery()
      const recording = beginCreate()
      let current = existing
      try {
        if (!current) {
          current = {
            operationId: envelope.operationId,
            sessionId: await backend.upload(source),
            source,
          }
          pending.set(envelope.command.resourceId, current)
        }
        const version = await initialFileContentVersion(source.bytes, metadata)
        const delivery = deliverExpectedCreateResult(
          readLiveStructureResult(
            await backend.create({
              campaignId,
              operationId: envelope.operationId,
              command: toLiveStructureMutationCommand(
                normalizeResourceStructureCommand(envelope.command),
              ),
              uploadSessionId: current.sessionId,
              metadata,
              version,
            }),
          ),
          envelope.operationId,
          envelope.command.resourceId,
        )
        pending.delete(envelope.command.resourceId)
        if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
          await backend.discard(current.sessionId)
        }
        return await finalizeLiveContentCreate(
          delivery,
          envelope.command.resourceId,
          envelope.command.parentId,
          backend,
          recording,
        )
      } catch {
        return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
      }
    },
    dispose: () => {
      content.dispose()
      for (const create of pending.values()) void backend.discard(create.sessionId)
      pending.clear()
    },
  }
}

async function fetchFile(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new TypeError('File download failed')
  return response
}
