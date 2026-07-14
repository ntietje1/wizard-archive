import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import type { CampaignMutationCtx } from '../../functions'
import { prepareCanvasContentCopy } from './canvasContent'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { prepareFileContentCopy } from './fileContent'
import { prepareMapContentCopy } from './mapContent'
import { prepareNoteContentCopy } from './noteContent'

export type ResourceContentCopyInput = Readonly<{
  sourceResourceId: ResourceId
  destinationResourceId: ResourceId
  kind: ResourceKind
}>

export async function prepareResourceContentCopies(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  copies: ReadonlyArray<ResourceContentCopyInput>,
): Promise<
  | { status: 'ready'; commits: ReadonlyArray<() => Promise<void>> }
  | { status: 'unavailable' }
  | { status: 'integrity_error' }
> {
  const preparations = await Promise.all(
    copies.map((copy) => prepareResourceContentCopy(ctx, campaignId, operationId, copy)),
  )
  if (preparations.some((preparation) => preparation.status === 'integrity_error')) {
    return { status: 'integrity_error' }
  }
  if (preparations.some((preparation) => preparation.status === 'unavailable')) {
    return { status: 'unavailable' }
  }

  const plans = preparations.flatMap((preparation) =>
    preparation.status === 'ready' ? [preparation.plan] : [],
  )
  const resourceTargets: Array<CanonicalTargetMapEntry> = copies.map((copy) => ({
    source: { kind: 'resource', resourceId: copy.sourceResourceId },
    destination: { kind: 'resource', resourceId: copy.destinationResourceId },
  }))
  const targetMap = [...resourceTargets, ...plans.flatMap((plan) => plan.referenceableTargets)]
  const commits = await Promise.all(plans.map((plan) => plan.finalize(targetMap)))
  return { status: 'ready', commits }
}

async function prepareResourceContentCopy(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  copy: ResourceContentCopyInput,
): Promise<ContentCopyPreparation | { status: 'empty' }> {
  switch (copy.kind) {
    case 'folder':
      return { status: 'empty' }
    case 'note':
      return await prepareNoteContentCopy(
        ctx,
        campaignId,
        operationId,
        copy.sourceResourceId,
        copy.destinationResourceId,
      )
    case 'file':
      return await prepareFileContentCopy(
        ctx,
        campaignId,
        operationId,
        copy.sourceResourceId,
        copy.destinationResourceId,
      )
    case 'map':
      return await prepareMapContentCopy(
        ctx,
        campaignId,
        operationId,
        copy.sourceResourceId,
        copy.destinationResourceId,
      )
    case 'canvas':
      return await prepareCanvasContentCopy(
        ctx,
        campaignId,
        copy.sourceResourceId,
        copy.destinationResourceId,
      )
  }
}
