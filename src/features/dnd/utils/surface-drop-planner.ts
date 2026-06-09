import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { validateEmbedDropTarget } from 'shared/embeds/drop-validation'
import { validateNoteLinkDropTarget } from 'shared/links/drop-validation'
import { validatePinDropTarget } from 'shared/game-maps/drop-validation'
import { assertNever } from '~/shared/utils/utils'
import type { SurfaceDropPlanningContext } from './drop-planning-context'
import type { DropRejectionReason } from './drop-rejections'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from './drop-target-data'
import { getSurfaceDropContribution } from './surface-drop-vocabulary'
import type {
  CanvasDropZoneData,
  MapDropZoneData,
  NoteEditorDropZoneData,
  SidebarDropData,
} from './drop-target-data'
import type { SurfaceDropAction, SurfaceDropCommandIdForAction } from './surface-drop-vocabulary'

type SurfaceBatchDropBase<TAction extends SurfaceDropAction, TTarget> = {
  commandId: SurfaceDropCommandIdForAction<TAction>
  action: TAction
  items: Array<AnySidebarItem>
  rejectedItems: Array<DropRejectedItem>
  target: TTarget
  label: string
}

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
      target: NoteEditorDropZoneData
    }

type DropRejectedItem = {
  item: AnySidebarItem
  reason: DropRejectionReason
}

export type SurfaceBatchDropCommand =
  | ({ status: 'ready' } & SurfaceBatchDropBase<'pin', MapDropZoneData>)
  | ({ status: 'partial' } & SurfaceBatchDropBase<'pin', MapDropZoneData>)
  | ({ status: 'ready' } & SurfaceBatchDropBase<'link', NoteEditorDropZoneData>)
  | ({ status: 'partial' } & SurfaceBatchDropBase<'link', NoteEditorDropZoneData>)
  | ({ status: 'ready' } & SurfaceBatchDropBase<'embed', CanvasDropZoneData>)
  | ({ status: 'partial' } & SurfaceBatchDropBase<'embed', CanvasDropZoneData>)
  | ({ status: 'ready' } & SurfaceBatchDropBase<'noteEmbed', NoteEditorDropZoneData>)
  | ({ status: 'partial' } & SurfaceBatchDropBase<'noteEmbed', NoteEditorDropZoneData>)
  | ({ status: 'failed'; items: [] } & Omit<SurfaceBatchDropBase<'pin', MapDropZoneData>, 'items'>)
  | ({ status: 'failed'; items: [] } & Omit<
      SurfaceBatchDropBase<'link', NoteEditorDropZoneData>,
      'items'
    >)
  | ({ status: 'failed'; items: [] } & Omit<
      SurfaceBatchDropBase<'embed', CanvasDropZoneData>,
      'items'
    >)
  | ({ status: 'failed'; items: [] } & Omit<
      SurfaceBatchDropBase<'noteEmbed', NoteEditorDropZoneData>,
      'items'
    >)

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
  items: Array<AnySidebarItem>,
  rejectedItems: Array<DropRejectedItem>,
): SurfaceBatchDropCommand {
  const base = {
    status,
    items,
    rejectedItems,
    label: getBatchLabel(batchTarget, items.length),
  }

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

function createFailedSurfaceBatchCommand(
  batchTarget: BatchDropTarget,
  rejectedItems: Array<DropRejectedItem>,
): SurfaceBatchDropCommand {
  const base = {
    status: 'failed' as const,
    items: [] as [],
    rejectedItems,
    label: getFailedLabel(batchTarget, rejectedItems.length),
  }

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
    default:
      return null
  }
}

function validateSurfaceDropItem(
  item: AnySidebarItem,
  batchTarget: BatchDropTarget,
  ctx: SurfaceDropPlanningContext,
): DropRejectionReason | null {
  switch (batchTarget.action) {
    case 'pin':
      return validatePinDropTarget({
        mapId: batchTarget.target.mapId,
        item,
        existingPinItemIds: batchTarget.target.pinnedItemIds ?? [],
        campaignId: ctx.campaignId,
      })
    case 'link':
      return validateNoteLinkDropTarget({
        noteId: batchTarget.target.noteId,
        item,
        campaignId: ctx.campaignId,
      })
    case 'embed':
      return validateEmbedDropTarget({
        targetId: batchTarget.target.canvasId,
        item,
        campaignId: ctx.campaignId,
      })
    case 'noteEmbed':
      return validateEmbedDropTarget({
        targetId: batchTarget.target.noteId,
        item,
        campaignId: ctx.campaignId,
      })
    default:
      return assertNever(batchTarget)
  }
}

export function resolveSurfaceDropCommand(
  items: Array<AnySidebarItem>,
  target: SidebarDropData,
  ctx: SurfaceDropPlanningContext,
  options: SurfaceDropOptions = {},
): SurfaceDropCommand {
  if (items.length === 0) return { status: 'noop' }

  const batchTarget = resolveBatchDropTarget(target, options)
  if (!batchTarget) return { status: 'noop' }
  const acceptedItems: Array<AnySidebarItem> = []
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
    return createFailedSurfaceBatchCommand(batchTarget, rejectedItems)
  }
  return createSurfaceBatchCommand(
    batchTarget,
    rejectedItems.length > 0 ? 'partial' : 'ready',
    acceptedItems,
    rejectedItems,
  )
}
