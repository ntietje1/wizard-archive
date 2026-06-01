import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { validateCanvasEmbedDropTarget } from '~/features/canvas/domain/dropValidation'
import { validateNoteLinkDropTarget } from 'shared/links/drop-validation'
import { validatePinDropTarget } from 'convex/gameMaps/validation'
import { assertNever } from '~/shared/utils/utils'
import type { SurfaceDropPlanningContext } from './drop-planning-context'
import type { DropRejectionReason } from './drop-rejections'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from './drop-target-data'
import type {
  CanvasDropZoneData,
  MapDropZoneData,
  NoteEditorDropZoneData,
  SidebarDropData,
} from './drop-target-data'

type BatchDropAction = 'pin' | 'embed' | 'link'

type SurfaceBatchDropBase<TAction extends BatchDropAction, TTarget> = {
  action: TAction
  items: Array<AnySidebarItem>
  rejectedItems: Array<DropRejectedItem>
  target: TTarget
  label: string
}

type BatchDropTarget =
  | { action: 'pin'; target: MapDropZoneData }
  | { action: 'link'; target: NoteEditorDropZoneData }
  | { action: 'embed'; target: CanvasDropZoneData }

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
  | ({ status: 'failed'; items: [] } & Omit<SurfaceBatchDropBase<'pin', MapDropZoneData>, 'items'>)
  | ({ status: 'failed'; items: [] } & Omit<
      SurfaceBatchDropBase<'link', NoteEditorDropZoneData>,
      'items'
    >)
  | ({ status: 'failed'; items: [] } & Omit<
      SurfaceBatchDropBase<'embed', CanvasDropZoneData>,
      'items'
    >)

export type SurfaceDropCommand =
  | { status: 'noop' }
  | { status: 'blocked'; reason: DropRejectionReason }
  | SurfaceBatchDropCommand

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
        action: 'pin',
        target: batchTarget.target,
      }
    case 'link':
      return {
        ...base,
        action: 'link',
        target: batchTarget.target,
      }
    case 'embed':
      return {
        ...base,
        action: 'embed',
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
        action: 'pin',
        target: batchTarget.target,
      }
    case 'link':
      return {
        ...base,
        action: 'link',
        target: batchTarget.target,
      }
    case 'embed':
      return {
        ...base,
        action: 'embed',
        target: batchTarget.target,
      }
    default:
      return assertNever(batchTarget)
  }
}

function resolveBatchDropTarget(target: SidebarDropData): BatchDropTarget | null {
  switch (target.type) {
    case MAP_DROP_ZONE_TYPE:
      return { action: 'pin', target }
    case NOTE_EDITOR_DROP_TYPE:
      return { action: 'link', target }
    case CANVAS_DROP_ZONE_TYPE:
      return { action: 'embed', target }
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
      return validateCanvasEmbedDropTarget({
        canvasId: batchTarget.target.canvasId,
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
): SurfaceDropCommand {
  if (items.length === 0) return { status: 'noop' }

  const batchTarget = resolveBatchDropTarget(target)
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
