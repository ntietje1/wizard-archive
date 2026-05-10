import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { validateCanvasEmbedDropTarget } from 'convex/canvases/dropValidation'
import { validateNoteLinkDropTarget } from 'convex/links/dropValidation'
import { validatePinDropTarget } from 'convex/gameMaps/validation'
import {
  evaluateMoveToParent,
  evaluateRestore,
  evaluateTrash,
} from 'convex/sidebarItems/operations/capabilities'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { operation, rejection } from './drop-outcome'
import type { DropOutcome } from './drop-outcome'
import { actorFromDropPlanningContext } from './drop-planning-context'
import type { DropPlanningContext } from './drop-planning-context'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
  TRASH_DROP_ZONE_TYPE,
} from './drop-target-data'
import type {
  CanvasDropZoneData,
  MapDropZoneData,
  NoteEditorDropZoneData,
  ResolvedSidebarItemDropData,
  SidebarDropData,
} from './drop-target-data'
import { toDropRejectionReason } from './drop-rejections'

function capabilityRejection(result: ReturnType<typeof evaluateMoveToParent>) {
  return result.ok ? null : rejection(toDropRejectionReason(result.code))
}

function resolveTrashDropOutcome(
  item: AnySidebarItem,
  ctx: DropPlanningContext,
): DropOutcome | null {
  if (item.location === SIDEBAR_ITEM_LOCATION.trash) return null
  const capability = evaluateTrash(actorFromDropPlanningContext(ctx), item)
  return capabilityRejection(capability) ?? operation('trash', 'Move to "Trash"')
}

function resolveRootDropOutcome(
  item: AnySidebarItem,
  ctx: DropPlanningContext,
): DropOutcome | null {
  const name = ctx.campaignName || 'Root'

  if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
    const capability = evaluateRestore(actorFromDropPlanningContext(ctx), item, {
      parentId: null,
      parent: null,
    })
    return capabilityRejection(capability) ?? operation('restore', `Restore to "${name}"`)
  }

  if (item.parentId === null) return null

  const capability = evaluateMoveToParent(actorFromDropPlanningContext(ctx), item, {
    parentId: null,
    parent: null,
  })
  return capabilityRejection(capability) ?? operation('move', `Move to "${name}"`)
}

function resolveFolderDropOutcome(
  item: AnySidebarItem,
  target: ResolvedSidebarItemDropData,
  ctx: DropPlanningContext,
): DropOutcome | null {
  if (item._id === target._id) return null
  const folderId = target._id as Id<'sidebarItems'>

  if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
    const capability = evaluateRestore(actorFromDropPlanningContext(ctx), item, {
      parentId: folderId,
      parent: target,
      ancestorIds: target.ancestorIds,
    })
    return capabilityRejection(capability) ?? operation('restore', `Restore to "${target.name}"`)
  }

  if (item.parentId === target._id) return null

  const capability = evaluateMoveToParent(actorFromDropPlanningContext(ctx), item, {
    parentId: folderId,
    parent: target,
    ancestorIds: target.ancestorIds,
  })
  return capabilityRejection(capability) ?? operation('move', `Move to "${target.name}"`)
}

function resolveMapDropOutcome(
  item: AnySidebarItem,
  target: MapDropZoneData,
  ctx: DropPlanningContext,
): DropOutcome {
  const reason = validatePinDropTarget({
    mapId: target.mapId,
    item,
    existingPinItemIds: target.pinnedItemIds ?? [],
    campaignId: ctx.campaignId,
  })
  return reason ? rejection(reason) : operation('pin', `Pin to "${target.mapName}"`)
}

function resolveNoteDropOutcome(
  item: AnySidebarItem,
  target: NoteEditorDropZoneData,
  ctx: DropPlanningContext,
): DropOutcome {
  const reason = validateNoteLinkDropTarget({
    noteId: target.noteId,
    item,
    campaignId: ctx.campaignId,
  })
  return reason ? rejection(reason) : operation('link', 'Add link here')
}

function resolveCanvasDropOutcome(
  item: AnySidebarItem,
  target: CanvasDropZoneData,
  ctx: DropPlanningContext,
): DropOutcome {
  const reason = validateCanvasEmbedDropTarget({
    canvasId: target.canvasId,
    item,
    campaignId: ctx.campaignId,
  })
  return reason ? rejection(reason) : operation('embed', 'Add to canvas')
}

function shouldRequireSourceFullAccess(outcome: DropOutcome) {
  return (
    outcome.type === 'operation' &&
    (outcome.action === 'move' || outcome.action === 'trash' || outcome.action === 'restore')
  )
}

export function resolveDropOutcome(
  item: AnySidebarItem | null,
  target: SidebarDropData | null,
  ctx: DropPlanningContext,
): DropOutcome | null {
  if (!item || !target) return null

  const outcome = (() => {
    switch (target.type) {
      case TRASH_DROP_ZONE_TYPE:
        return resolveTrashDropOutcome(item, ctx)
      case MAP_DROP_ZONE_TYPE:
        return resolveMapDropOutcome(item, target, ctx)
      case EMPTY_EDITOR_DROP_TYPE:
        return operation('open', 'Open in editor')
      case SIDEBAR_ROOT_DROP_TYPE:
        return resolveRootDropOutcome(item, ctx)
      case SIDEBAR_ITEM_TYPES.folders:
        return resolveFolderDropOutcome(item, target, ctx)
      case NOTE_EDITOR_DROP_TYPE:
        return resolveNoteDropOutcome(item, target, ctx)
      case CANVAS_DROP_ZONE_TYPE:
        return resolveCanvasDropOutcome(item, target, ctx)
      default:
        return null
    }
  })()

  if (
    outcome &&
    shouldRequireSourceFullAccess(outcome) &&
    item.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS
  ) {
    return rejection('no_permission')
  }

  return outcome
}
