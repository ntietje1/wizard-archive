import type { AnyItem } from '../workspace/items'
import { validateEmbedDropTarget } from '../embeds/drop-validation'
import { validateNoteLinkDropTarget } from '../notes/links/drop-validation'
import { validatePinDropTarget } from '../game-maps/document-contract'
import type { SurfaceDropPlanningContext } from './planning-context'
import type { DropRejectionReason } from './rejections'
import { assertNever } from './exhaustiveness'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from './drop-target-data'
import { getSurfaceDropContribution } from './surface-vocabulary'
import type {
  CanvasDropZoneData,
  EmptyEmbedDropZoneData,
  MapDropZoneData,
  NoteEditorDropZoneData,
  SidebarDropData,
} from './drop-target-data'
import type { SurfaceDropAction, SurfaceDropCommandIdForAction } from './surface-vocabulary'

type SurfaceBatchDropBase<TAction extends SurfaceDropAction, TTarget> = {
  commandId: SurfaceDropCommandIdForAction<TAction>
  action: TAction
  items: Array<AnyItem>
  rejectedItems: Array<DropRejectedItem>
  target: TTarget
  label: string
}

type NoteEmbedDropTarget = NoteEditorDropZoneData | EmptyEmbedDropZoneData

type BatchDropTarget =
  | {
      action: 'pin'
      commandId: SurfaceDropCommandIdForAction<'pin'>
      target: MapDropZoneData
    }
  | {
      action: 'link'
      commandId: SurfaceDropCommandIdForAction<'link'>
      target: NoteEditorDropZoneData
    }
  | {
      action: 'embed'
      commandId: SurfaceDropCommandIdForAction<'embed'>
      target: CanvasDropZoneData
    }
  | {
      action: 'noteEmbed'
      commandId: SurfaceDropCommandIdForAction<'noteEmbed'>
      target: NoteEmbedDropTarget
    }

type DropRejectedItem = {
  item: AnyItem
  reason: DropRejectionReason
}

type SurfaceBatchDropCommandFor<TBatchTarget extends BatchDropTarget> =
  TBatchTarget extends BatchDropTarget
    ?
        | {
            [TStatus in 'ready' | 'partial']: { status: TStatus } & SurfaceBatchDropBase<
              TBatchTarget['action'],
              TBatchTarget['target']
            >
          }['ready' | 'partial']
        | ({ status: 'failed'; items: [] } & Omit<
            SurfaceBatchDropBase<TBatchTarget['action'], TBatchTarget['target']>,
            'items'
          >)
    : never

export type SurfaceBatchDropCommand = SurfaceBatchDropCommandFor<BatchDropTarget>

export type SurfaceDropCommand =
  | { status: 'noop' }
  | { status: 'blocked'; reason: DropRejectionReason }
  | SurfaceBatchDropCommand

export type SurfaceDropOptions = {
  noteEditorDropAction?: 'link' | 'embed'
}

function getBatchLabel(batchTarget: BatchDropTarget, count: number) {
  switch (batchTarget.action) {
    case 'pin':
      return count === 1
        ? `Pin item to "${batchTarget.target.mapName}"`
        : `Pin ${count} items to "${batchTarget.target.mapName}"`
    case 'link':
      return count === 1 ? 'Add link here' : `Add ${count} links here`
    case 'embed':
      return count === 1 ? 'Embed item in canvas' : `Embed ${count} items in canvas`
    case 'noteEmbed':
      return count === 1 ? 'Embed item here' : `Embed ${count} items here`
    default:
      return assertNever(batchTarget)
  }
}

function getFailedLabel(batchTarget: BatchDropTarget, rejectedCount: number) {
  const isSingleItem = rejectedCount === 1
  switch (batchTarget.action) {
    case 'pin':
      return isSingleItem
        ? `This item cannot be pinned to "${batchTarget.target.mapName}"`
        : `No items can be pinned to "${batchTarget.target.mapName}"`
    case 'link':
      return isSingleItem ? 'This item cannot be linked here' : 'No items can be linked here'
    case 'embed':
      return isSingleItem
        ? 'This item cannot be embedded in canvas'
        : 'No items can be embedded in canvas'
    case 'noteEmbed':
      return isSingleItem ? 'This item cannot be embedded here' : 'No items can be embedded here'
    default:
      return assertNever(batchTarget)
  }
}

function createSurfaceBatchCommand(
  batchTarget: BatchDropTarget,
  status: 'ready' | 'partial',
  items: Array<AnyItem>,
  rejectedItems: Array<DropRejectedItem>,
): SurfaceBatchDropCommand {
  return attachBatchTarget(
    {
      status,
      items,
      rejectedItems,
      label: getBatchLabel(batchTarget, items.length),
    },
    batchTarget,
  )
}

function createFailedSurfaceBatchCommand(
  batchTarget: BatchDropTarget,
  rejectedItems: Array<DropRejectedItem>,
): SurfaceBatchDropCommand {
  return attachBatchTarget(
    {
      status: 'failed' as const,
      items: [] as [],
      rejectedItems,
      label: getFailedLabel(batchTarget, rejectedItems.length),
    },
    batchTarget,
  )
}

function attachBatchTarget(
  base:
    | {
        status: 'ready' | 'partial'
        items: Array<AnyItem>
        rejectedItems: Array<DropRejectedItem>
        label: string
      }
    | {
        status: 'failed'
        items: []
        rejectedItems: Array<DropRejectedItem>
        label: string
      },
  batchTarget: BatchDropTarget,
): SurfaceBatchDropCommand {
  // TypeScript cannot distribute a spread over BatchDropTarget, so each branch preserves its pair.
  switch (batchTarget.action) {
    case 'pin':
      return {
        ...base,
        commandId: batchTarget.commandId,
        action: 'pin',
        target: batchTarget.target,
      }
    case 'link':
      return {
        ...base,
        commandId: batchTarget.commandId,
        action: 'link',
        target: batchTarget.target,
      }
    case 'embed':
      return {
        ...base,
        commandId: batchTarget.commandId,
        action: 'embed',
        target: batchTarget.target,
      }
    case 'noteEmbed':
      return {
        ...base,
        commandId: batchTarget.commandId,
        action: 'noteEmbed',
        target: batchTarget.target,
      }
    default:
      return assertNever(batchTarget)
  }
}

function resolveBatchDropTarget(
  target: SidebarDropData,
  options: SurfaceDropOptions = {},
): BatchDropTarget | null {
  switch (target.type) {
    case MAP_DROP_ZONE_TYPE: {
      const contribution = getSurfaceDropContribution('pin')
      return { action: contribution.action, commandId: contribution.commandId, target }
    }
    case NOTE_EDITOR_DROP_TYPE: {
      if (options.noteEditorDropAction === 'embed') {
        const contribution = getSurfaceDropContribution('noteEmbed')
        return { action: contribution.action, commandId: contribution.commandId, target }
      }
      const contribution = getSurfaceDropContribution('link')
      return { action: contribution.action, commandId: contribution.commandId, target }
    }
    case CANVAS_DROP_ZONE_TYPE: {
      const contribution = getSurfaceDropContribution('embed')
      return { action: contribution.action, commandId: contribution.commandId, target }
    }
    case EMPTY_EMBED_DROP_TYPE: {
      const contribution = getSurfaceDropContribution('noteEmbed')
      return { action: contribution.action, commandId: contribution.commandId, target }
    }
    default:
      return null
  }
}

function getNoteEmbedTargetId(target: NoteEmbedDropTarget) {
  return target.type === NOTE_EDITOR_DROP_TYPE ? target.noteId : target.sourceItemId
}

function validateSurfaceDropItem(
  item: AnyItem,
  batchTarget: BatchDropTarget,
  ctx: SurfaceDropPlanningContext,
): DropRejectionReason | null {
  const workspaceScopedItem = { ...item, workspaceId: item.campaignId }
  switch (batchTarget.action) {
    case 'pin':
      return validatePinDropTarget({
        mapId: batchTarget.target.mapId,
        item: workspaceScopedItem,
        existingPinItemIds: batchTarget.target.pinnedItemIds ?? [],
        workspaceId: ctx.workspaceId,
      })
    case 'link':
      return validateNoteLinkDropTarget({
        noteId: batchTarget.target.noteId,
        item: workspaceScopedItem,
        workspaceId: ctx.workspaceId,
      })
    case 'embed':
      return validateEmbedDropTarget({
        targetId: batchTarget.target.canvasId,
        item: workspaceScopedItem,
        workspaceId: ctx.workspaceId,
      })
    case 'noteEmbed':
      return validateEmbedDropTarget({
        targetId: getNoteEmbedTargetId(batchTarget.target),
        item: workspaceScopedItem,
        workspaceId: ctx.workspaceId,
      })
    default:
      return assertNever(batchTarget)
  }
}

export function resolveSurfaceDropCommand(
  items: Array<AnyItem>,
  target: SidebarDropData,
  ctx: SurfaceDropPlanningContext,
  options: SurfaceDropOptions = {},
): SurfaceDropCommand {
  if (items.length === 0) return { status: 'noop' }
  if (target.type === EMPTY_EMBED_DROP_TYPE && items.length !== 1) {
    return { status: 'blocked', reason: 'unexpected_action' }
  }

  const batchTarget = resolveBatchDropTarget(target, options)
  if (!batchTarget) return { status: 'noop' }
  const acceptedItems: Array<AnyItem> = []
  const rejectedItems: Array<DropRejectedItem> = []

  for (const item of items) {
    const reason = validateSurfaceDropItem(item, batchTarget, ctx)
    if (reason) {
      rejectedItems.push({ item, reason })
      continue
    }
    acceptedItems.push(item)
  }

  if (acceptedItems.length === 0) {
    const onlyRejectedItem = rejectedItems[0]
    if (onlyRejectedItem && rejectedItems.length === 1) {
      return { status: 'blocked', reason: onlyRejectedItem.reason }
    }
    return createFailedSurfaceBatchCommand(batchTarget, rejectedItems)
  }
  return createSurfaceBatchCommand(
    batchTarget,
    rejectedItems.length > 0 ? 'partial' : 'ready',
    acceptedItems,
    rejectedItems,
  )
}
