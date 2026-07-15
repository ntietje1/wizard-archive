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
import { createLiveResourceContentSource } from './live-resource-content-source'
import type { LiveResourceContentBackend } from './live-resource-content-source'
import {
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'

type CreateFileArgs = FunctionArgs<typeof api.resources.mutations.createFileResource>
type CreateFileResult = FunctionReturnType<typeof api.resources.mutations.createFileResource>

type LiveFileContentBackend = LiveResourceContentBackend &
  Readonly<{
    create(args: CreateFileArgs): Promise<CreateFileResult>
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
        const result = readLiveStructureResult(
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
        )
        pending.delete(envelope.command.resourceId)
        if (result.status !== 'completed') {
          recording.abandon()
          await backend.discard(current.sessionId)
          return { status: 'received', result }
        }
        await backend.refresh(envelope.command.resourceId, envelope.command.parentId)
        recording.completed(result.receipt)
        return { status: 'received', result }
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
