import type { ResourceId } from '../resources/domain-id'
import type { FileSystemDropOptions } from '../filesystem/domain/intent-planning'
import type { AnyItem } from '../workspace/items'
import type { DragOverlayState } from './drag-overlay'
import type { PlannedDropCommand } from './drop-command'
import { resolveDropCommand, resolveDropCommandFeedback } from './drop-command-planner'
import { getDropTargetKey, resolveDropTarget } from './drop-target-data'
import type { ElementDragMonitorContext } from './monitor-context'
import type { DropOutcome } from './outcome'
import { getDragItemId, getDragItemIds, getDragPreviewItemIds } from './source-data'
import type { SurfaceDropOptions } from './surface-planner'

export type ElementDropOptions = FileSystemDropOptions & SurfaceDropOptions

type ElementDragFeedbackResult = {
  dragState: {
    draggedItemCount: number | undefined
    outcome: DropOutcome | null
    rejectedItemCount: number | undefined
  }
  dropTargetKey: string | null
}

type ElementDragStartPlan = {
  dragPreviewItemIds: Array<ResourceId>
  dragState: DragOverlayState
}

type ElementDragFeedbackInput = {
  feedbackKey: string
  options: ElementDropOptions
  rawDropTarget: Record<string, unknown> | null
}

type ElementDragLocation = {
  current: {
    input: {
      ctrlKey?: boolean
      shiftKey?: boolean
    }
    dropTargets: Array<{ data: Record<string, unknown> }>
  }
}

function getRejectedItemCount(command: PlannedDropCommand): number | undefined {
  if (command.kind !== 'surface') return undefined
  switch (command.command.status) {
    case 'partial':
    case 'failed':
      return command.command.rejectedItems.length || undefined
    default:
      return undefined
  }
}

export function globalDropOptionsFromInput(input: {
  ctrlKey?: boolean
  shiftKey?: boolean
}): ElementDropOptions {
  return {
    copy: input.ctrlKey === true,
    noteEditorDropAction: input.shiftKey === true ? 'embed' : 'link',
  }
}

export function getElementDragFeedbackInput(
  location: ElementDragLocation,
): ElementDragFeedbackInput {
  const input = location.current.input
  const topTarget = location.current.dropTargets[0]
  const rawDropTarget = topTarget ? topTarget.data : null
  const key = getDropTargetKey(rawDropTarget)
  const options = globalDropOptionsFromInput(input)

  return {
    feedbackKey: `${key ?? 'none'}:${options.copy ? 'copy' : 'default'}:${options.noteEditorDropAction}`,
    options,
    rawDropTarget,
  }
}

export function planElementDragStart({
  ctx,
  sourceData,
}: {
  ctx: ElementDragMonitorContext
  sourceData: Record<string, unknown>
}): ElementDragStartPlan {
  const draggedItems = resolveDraggedItems(sourceData, ctx)
  const draggedPreviewItems = resolveDraggedPreviewItems(sourceData, ctx)
  const draggedItem = draggedItems[0] ?? resolveDraggedItem(sourceData, ctx)

  return {
    dragPreviewItemIds: draggedPreviewItems.map((item) => item.id),
    dragState: draggedItem
      ? {
          draggedItem,
          draggedItemCount: overlayItemCount(draggedPreviewItems),
          outcome: null,
        }
      : null,
  }
}

export function planElementDragFeedback({
  ctx,
  options,
  rawDropTarget,
  sourceData,
}: {
  ctx: ElementDragMonitorContext
  options: ElementDropOptions
  rawDropTarget: Record<string, unknown> | null
  sourceData: Record<string, unknown>
}): ElementDragFeedbackResult {
  const dropTarget = resolveMonitorDropTarget(rawDropTarget, ctx)
  const draggedItems = resolveCompleteDraggedItems(sourceData, ctx)
  const draggedPreviewItems = resolveDraggedPreviewItems(sourceData, ctx)

  if (!draggedItems) {
    return {
      dragState: {
        draggedItemCount: overlayItemCount(draggedPreviewItems),
        outcome: null,
        rejectedItemCount: undefined,
      },
      dropTargetKey: null,
    }
  }

  const command = resolveDropCommand({
    payload: { kind: 'resources', items: draggedItems },
    target: dropTarget,
    ctx: ctx.dropPlanningContext,
    options,
  })
  const outcome = resolveDropCommandFeedback(command)

  return {
    dragState: {
      draggedItemCount: overlayItemCount(draggedPreviewItems),
      outcome,
      rejectedItemCount: getRejectedItemCount(command),
    },
    dropTargetKey: getDropTargetKey(dropTarget),
  }
}

function resolveDraggedItem(
  sourceData: Record<string, unknown>,
  ctx: ElementDragMonitorContext,
): AnyItem | null {
  const sid = getDragItemId(sourceData)
  return sid ? ctx.catalog.getKnownItemById(sid) : null
}

function resolveDraggedItems(
  sourceData: Record<string, unknown>,
  ctx: ElementDragMonitorContext,
): Array<AnyItem> {
  return ctx.operationItems.resolveItems({
    itemIds: getDragItemIds(sourceData),
    includeTrashed: true,
  })
}

function resolveCompleteDraggedItems(
  sourceData: Record<string, unknown>,
  ctx: ElementDragMonitorContext,
): Array<AnyItem> | null {
  const draggedItemIds = getDragItemIds(sourceData)
  const draggedItems = resolveDraggedItems(sourceData, ctx)
  if (draggedItems.length === 0 || draggedItems.length !== draggedItemIds.length) return null
  return draggedItems
}

function resolveDraggedPreviewItems(
  sourceData: Record<string, unknown>,
  ctx: ElementDragMonitorContext,
): Array<AnyItem> {
  return getDragPreviewItemIds(sourceData)
    .map((id) => ctx.catalog.getKnownItemById(id))
    .filter((item): item is AnyItem => Boolean(item))
}

function overlayItemCount(items: Array<unknown>) {
  return items.length > 1 ? items.length : undefined
}

function resolveMonitorDropTarget(
  rawDropTarget: Record<string, unknown> | null,
  ctx: ElementDragMonitorContext,
) {
  return rawDropTarget
    ? resolveDropTarget(rawDropTarget, ctx.catalog, { runtimeId: ctx.runtimeId ?? null })
    : null
}
