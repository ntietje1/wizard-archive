import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CreateCanvasResourceCommand,
  CreateMapResourceCommand,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { normalizeResourceStructureCommand } from '@wizard-archive/editor/resources/command-protocol'
import type { ResourceHistoryRecording } from '@wizard-archive/editor/resources/undo-history'
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

export async function finalizeLiveContentCreate(
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  resourceId: ResourceId,
  parentId: ResourceId | null,
  backend: Pick<LiveFixedContentCreateBackend, 'refresh'>,
  recording: ResourceHistoryRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
    recording.abandon()
    return delivery
  }
  await backend.refresh(resourceId, parentId)
  recording.completed(delivery.result.receipt)
  return delivery
}

export async function createLiveFixedContentResource(
  campaignId: CampaignId,
  envelope: CommandEnvelope<CreateMapResourceCommand | CreateCanvasResourceCommand>,
  backend: LiveFixedContentCreateBackend,
  beginCreate: () => ResourceHistoryRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (envelope.campaignId !== campaignId) {
    return { status: 'received', result: { status: 'rejected', reason: 'invalid_command' } }
  }
  const recording = beginCreate()
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
      recording,
    )
  } catch {
    recording.abandon()
    return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
  }
}
