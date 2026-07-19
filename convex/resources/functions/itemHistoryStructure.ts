import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceGraph,
  ResourceGraphTransition,
} from '@wizard-archive/editor/resources/graph-transition'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { CampaignMutationCtx } from '../../functions'
import { recordItemHistoryEvent } from './itemHistory'

export async function recordResourceGraphTransitionHistory(
  ctx: CampaignMutationCtx,
  graph: ResourceGraph,
  transition: ResourceGraphTransition,
): Promise<void> {
  const next = new Map(transition.upserted.map((resource) => [resource.id, resource]))
  await Promise.all(
    transition.upserted.flatMap((resource) =>
      resourceHistoryEvents(graph, next, resource).map((event) =>
        recordItemHistoryEvent(ctx, resource.id, event),
      ),
    ),
  )
}

export async function recordResourceCopyHistory(
  ctx: CampaignMutationCtx,
  copies: ReadonlyArray<{ source: ResourceRecord; destination: ResourceRecord }>,
): Promise<void> {
  await Promise.all(
    copies.map(({ source, destination }) =>
      recordItemHistoryEvent(ctx, destination.id, {
        action: ITEM_HISTORY_ACTION.copied,
        metadata: { sourceResourceId: source.id, sourceTitle: source.title },
      }),
    ),
  )
}

function resourceHistoryEvents(
  graph: ResourceGraph,
  next: ReadonlyMap<ResourceId, ResourceRecord>,
  resource: ResourceRecord,
) {
  const previous = graph.resources.get(resource.id)
  if (!previous) {
    return [{ action: ITEM_HISTORY_ACTION.created, metadata: null }] as const
  }
  const events = []
  if (previous.title !== resource.title) {
    events.push({
      action: ITEM_HISTORY_ACTION.renamed,
      metadata: { from: previous.title, to: resource.title },
    } as const)
  }
  if (previous.parentId !== resource.parentId) {
    events.push({
      action: ITEM_HISTORY_ACTION.moved,
      metadata: {
        from: parentTitle(graph.resources, previous.parentId),
        to: parentTitle(next, resource.parentId) ?? parentTitle(graph.resources, resource.parentId),
      },
    } as const)
  }
  if (previous.icon !== resource.icon) {
    events.push({
      action: ITEM_HISTORY_ACTION.iconChanged,
      metadata: { from: previous.icon, to: resource.icon },
    } as const)
  }
  if (previous.color !== resource.color) {
    events.push({
      action: ITEM_HISTORY_ACTION.colorChanged,
      metadata: { from: previous.color, to: resource.color },
    } as const)
  }
  if (previous.lifecycle.state !== resource.lifecycle.state) {
    events.push({
      action:
        resource.lifecycle.state === 'trashed'
          ? ITEM_HISTORY_ACTION.trashed
          : ITEM_HISTORY_ACTION.restored,
      metadata: null,
    } as const)
  }
  return events
}

function parentTitle(
  resources: ReadonlyMap<ResourceId, ResourceRecord>,
  parentId: ResourceId | null,
): string | null {
  if (parentId === null) return null
  return resources.get(parentId)?.title ?? null
}
