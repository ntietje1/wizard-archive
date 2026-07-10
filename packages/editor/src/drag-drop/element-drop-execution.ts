import type { DndBatchDecision } from './batch-decision'
import { executePlannedDropCommand } from './drop-command-execution'
import { resolveDropCommand } from './drop-command-planner'
import { resolveDropTarget } from './drop-target-data'
import type { ElementDropOptions } from './element-drag-feedback'
import type { ElementDragMonitorContext } from './monitor-context'
import { getDragItemIds } from './source-data'
import { createSurfaceDropCommandUiEffects } from './surface-command-effects'

const surfaceDropCommandEffects = createSurfaceDropCommandUiEffects()

export async function executeElementDrop({
  ctx,
  input,
  options,
  setBatchDecision,
  sourceData,
  targetData,
}: {
  ctx: ElementDragMonitorContext
  sourceData: Record<string, unknown>
  targetData: Record<string, unknown>
  input: { clientX: number; clientY: number }
  options: ElementDropOptions
  setBatchDecision: (decision: DndBatchDecision | null) => void
}) {
  const draggedItemIds = getDragItemIds(sourceData)
  const draggedItems = ctx.operationItems.resolveItems({
    itemIds: draggedItemIds,
    includeTrashed: true,
  })
  if (draggedItems.length === 0 || draggedItems.length !== draggedItemIds.length) return

  const resolvedTarget = resolveDropTarget(targetData, ctx.catalog, {
    runtimeId: ctx.runtimeId ?? null,
  })
  if (!resolvedTarget) return

  await executePlannedDropCommand(
    resolveDropCommand({
      payload: { kind: 'resources', items: draggedItems },
      target: resolvedTarget,
      ctx: ctx.dropPlanningContext,
      options,
    }),
    input,
    {
      ...ctx.dndContext,
      setBatchDecision,
      surfaceEffects: surfaceDropCommandEffects,
    },
  )
}
