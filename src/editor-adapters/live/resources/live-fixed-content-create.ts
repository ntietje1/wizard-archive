import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CreateCanvasResourceCommand,
  CreateFileResourceCommand,
  CreateMapResourceCommand,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { normalizeResourceStructureCommand } from '@wizard-archive/editor/resources/command-protocol'
import type { ResourceUndoRecording } from '@wizard-archive/editor/resources/undo-history'
import {
  deliverExpectedCreateResult,
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'

type ContentCreateArgs = FunctionArgs<typeof api.resources.mutations.createMapResource>
type ContentCreateResult = FunctionReturnType<typeof api.resources.mutations.createMapResource>

export type LiveFixedContentCreateBackend = Readonly<{
  create(args: ContentCreateArgs): Promise<ContentCreateResult>
  refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
}>

async function finalizeLiveContentCreate(
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  resourceId: ResourceId,
  parentId: ResourceId | null,
  backend: Pick<LiveFixedContentCreateBackend, 'refresh'>,
  undoRecording: ResourceUndoRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
    undoRecording.abandon()
    return delivery
  }
  await backend.refresh(resourceId, parentId)
  undoRecording.completed(delivery.result.receipt)
  return delivery
}

export async function createLiveFixedContentResource(
  campaignId: CampaignId,
  envelope: CommandEnvelope<
    CreateMapResourceCommand | CreateCanvasResourceCommand | CreateFileResourceCommand
  >,
  backend: LiveFixedContentCreateBackend,
  beginCreateUndo: () => ResourceUndoRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (envelope.campaignId !== campaignId) {
    return { status: 'received', result: { status: 'rejected', reason: 'invalid_command' } }
  }
  const undoRecording = beginCreateUndo()
  try {
    const delivery = deliverExpectedCreateResult(
      readLiveStructureResult(
        await backend.create({
          campaignId,
          operationId: envelope.operationId,
          command: toLiveStructureMutationCommand(
            normalizeResourceStructureCommand(envelope.command),
          ),
        }),
      ),
      campaignId,
      envelope.operationId,
      envelope.command.resourceId,
    )
    return await finalizeLiveContentCreate(
      delivery,
      envelope.command.resourceId,
      envelope.command.parentId,
      backend,
      undoRecording,
    )
  } catch {
    undoRecording.abandon()
    return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
  }
}
