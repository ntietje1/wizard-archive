import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { validatePinTarget } from 'convex/gameMaps/validation'
import {
  evaluateMoveToParent,
  evaluateRestore,
  evaluateTrash,
} from 'convex/sidebarItems/operations/capabilities'
import type { SidebarOperationRejectionCode } from 'convex/sidebarItems/operations/capabilities'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import { toast } from 'sonner'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { assertNever } from '~/shared/utils/utils'

// ─── Constants ───────────────────────────────────────────────────────

export const CANVAS_DROP_ZONE_TYPE = 'canvas-drop-zone' as const
export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const
export const NOTE_EDITOR_DROP_TYPE = 'note-editor-drop' as const
export const SIDEBAR_ROOT_DROP_TYPE = 'root' as const
export const TRASH_DROP_ZONE_TYPE = 'trash-drop-zone' as const

// ─── Types ───────────────────────────────────────────────────────────

/** Type-safe extraction of sidebarItemId from raw drag source data. */
export function getDragItemId(sourceData: Record<string, unknown>): Id<'sidebarItems'> | null {
  const id = sourceData.sidebarItemId
  return typeof id === 'string' ? (id as Id<'sidebarItems'>) : null
}

export function getDragItemIds(sourceData: Record<string, unknown>): Array<Id<'sidebarItems'>> {
  const ids = sourceData.sidebarItemIds
  if (Array.isArray(ids)) {
    return ids.filter((id): id is Id<'sidebarItems'> => typeof id === 'string')
  }

  const legacyId = getDragItemId(sourceData)
  return legacyId ? [legacyId] : []
}

export function getDragPreviewItemIds(
  sourceData: Record<string, unknown>,
): Array<Id<'sidebarItems'>> {
  const ids = sourceData.sidebarDragPreviewItemIds
  if (Array.isArray(ids)) {
    return ids.filter((id): id is Id<'sidebarItems'> => typeof id === 'string')
  }

  return getDragItemIds(sourceData)
}

export type ResolvedSidebarItemDropData = AnySidebarItem & {
  ancestorIds?: Array<Id<'sidebarItems'>>
}

export interface CanvasDropZoneData {
  [key: string | symbol]: unknown
  type: typeof CANVAS_DROP_ZONE_TYPE
  canvasId: Id<'sidebarItems'>
}

export interface MapDropZoneData {
  [key: string | symbol]: unknown
  type: typeof MAP_DROP_ZONE_TYPE
  mapId: Id<'sidebarItems'>
  mapName: string
  pinnedItemIds?: ReadonlyArray<Id<'sidebarItems'>>
}

export interface SidebarRootDropZoneData {
  [key: string | symbol]: unknown
  type: typeof SIDEBAR_ROOT_DROP_TYPE
}

export interface EmptyEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof EMPTY_EDITOR_DROP_TYPE
}

export interface NoteEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof NOTE_EDITOR_DROP_TYPE
  noteId: Id<'sidebarItems'>
}

export interface TrashDropZoneData {
  [key: string | symbol]: unknown
  type: typeof TRASH_DROP_ZONE_TYPE
}

export type SidebarDropData =
  | ResolvedSidebarItemDropData
  | SidebarRootDropZoneData
  | CanvasDropZoneData
  | EmptyEditorDropZoneData
  | MapDropZoneData
  | NoteEditorDropZoneData
  | TrashDropZoneData

type DragDropAction = 'move' | 'trash' | 'restore' | 'pin' | 'embed' | 'open' | 'link' | null

type DropRejectionReason =
  | 'self_pin'
  | 'self_embed'
  | 'already_pinned'
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'
  | 'trashed_folder'
  | 'name_conflict'
  | 'dm_only'
  | 'trashed_item'

// ─── Outcome Types ──────────────────────────────────────────────────

type OperationOutcome = {
  type: 'operation'
  action: Exclude<DragDropAction, null>
  label: string
  execute: (() => Promise<void>) | null
}

type RejectionOutcome = {
  type: 'rejection'
  reason: DropRejectionReason
}

export type DropOutcome = OperationOutcome | RejectionOutcome

type DroppableMoveItemsResult =
  | {
      status: 'ready'
      action: 'move' | 'restore'
      items: Array<AnySidebarItem>
      parentId: Id<'sidebarItems'> | null
    }
  | { status: 'blocked' }
  | { status: 'noop' }
  | { status: 'none' }

type MoveDropAction = 'move' | 'restore'

type ResolvedMoveDropItem = {
  item: AnySidebarItem
  outcome: DropOutcome | null
}

type MoveDropOperation = {
  item: AnySidebarItem
  action: MoveDropAction
}

function operation(
  action: Exclude<DragDropAction, null>,
  label: string,
  execute?: () => Promise<void>,
): OperationOutcome {
  return { type: 'operation', action, label, execute: execute ?? null }
}

function rejection(reason: DropRejectionReason): RejectionOutcome {
  return { type: 'rejection', reason }
}

function actorFromContext(ctx: DndContext) {
  return { role: ctx.isDm ? CAMPAIGN_MEMBER_ROLE.DM : CAMPAIGN_MEMBER_ROLE.Player }
}

function toDropRejectionReason(code: SidebarOperationRejectionCode): DropRejectionReason {
  switch (code) {
    case 'no_source_permission':
    case 'no_target_permission':
      return 'no_permission'
    case 'dm_only':
      return 'dm_only'
    case 'circular':
      return 'circular'
    case 'trashed_folder':
      return 'trashed_folder'
    case 'trashed_item':
    case 'already_trashed':
      return 'trashed_item'
    case 'not_trashed':
      return 'missing_data'
    case 'not_found':
    case 'invalid_target':
      return 'missing_data'
    case 'not_folder':
    case 'different_location':
    case 'same_parent':
      return 'not_folder'
    default:
      return assertNever(code)
  }
}

function capabilityRejection(result: ReturnType<typeof evaluateMoveToParent>) {
  return result.ok ? null : rejection(toDropRejectionReason(result.code))
}

function isMoveDropAction(action: Exclude<DragDropAction, null>): action is MoveDropAction {
  return action === 'move' || action === 'restore'
}

// ─── Execution Context ──────────────────────────────────────────────

export interface DndContext {
  moveItems: (
    items: Array<AnySidebarItem>,
    parentId?: Id<'sidebarItems'> | null,
  ) => Promise<unknown>
  restoreItems: (
    items: Array<AnySidebarItem>,
    parentId?: Id<'sidebarItems'> | null,
  ) => Promise<unknown>
  trashItems: (items: Array<AnySidebarItem>) => Promise<unknown>
  navigateToItem: (slug: SidebarItemSlug, replace?: boolean) => Promise<void>
  campaignId: Id<'campaigns'> | null
  campaignName: string | undefined
  isDm: boolean
  setFolderOpen: (folderId: Id<'sidebarItems'>) => void
}

// ─── Drop Zone Config ───────────────────────────────────────────────

interface DropZoneConfig<T extends SidebarDropData = SidebarDropData> {
  resolve: (item: AnySidebarItem, target: T, ctx: DndContext) => DropOutcome | null
  canAcceptFiles: boolean | ((target: T) => boolean)
  getHighlightId: (target: T) => string | null
  getTargetKey?: (rawTarget: Record<string, unknown>) => string
}

/** Creates a typed config — T is erased for the registry but enforced within methods. */
function typedConfig<T extends SidebarDropData>(c: DropZoneConfig<T>): DropZoneConfig {
  return c as DropZoneConfig
}

// ─── Helpers ────────────────────────────────────────────────────────

export function rejectionReasonMessage(reason: DropRejectionReason): string {
  switch (reason) {
    case 'no_permission':
      return 'No permission to move here'
    case 'circular':
      return 'Cannot move folder into itself'
    case 'self_pin':
      return 'Cannot pin map to itself'
    case 'self_embed':
      return 'Cannot embed canvas into itself'
    case 'already_pinned':
      return 'Already pinned to this map'
    case 'not_folder':
      return 'Cannot drop here'
    case 'missing_data':
      return 'Missing data'
    case 'trashed_folder':
      return 'Trashed folders are uneditable'
    case 'name_conflict':
      return 'An item with this name already exists here'
    case 'dm_only':
      return 'Only the DM can do this'
    case 'trashed_item':
      return 'The item is trashed and cannot be used'
    default:
      return assertNever(reason)
  }
}

// ─── Configs ────────────────────────────────────────────────────────

const trashConfig: DropZoneConfig = {
  resolve: (item, _target, ctx) => {
    if (item.location === SIDEBAR_ITEM_LOCATION.trash) return null
    const capability = evaluateTrash(actorFromContext(ctx), item)
    const rejected = capabilityRejection(capability)
    if (rejected) return rejected
    return operation('trash', 'Move to "Trash"', async () => {
      await ctx.trashItems([item])
      toast.success('Moved to trash')
    })
  },
  canAcceptFiles: false,
  getHighlightId: () => TRASH_DROP_ZONE_TYPE,
}

const mapConfig = typedConfig<MapDropZoneData>({
  resolve: (item, t) => {
    const error = validatePinTarget(t.mapId, item._id, t.pinnedItemIds ?? [])
    if (error) {
      const isSelfPin = (item._id as string) === (t.mapId as string)
      return rejection(isSelfPin ? 'self_pin' : 'already_pinned')
    }
    return operation('pin', `Pin to "${t.mapName}"`)
  },
  canAcceptFiles: false,
  getHighlightId: (t) => `map:${t.mapId}`,
  getTargetKey: (raw) => `map:${String(raw.mapId)}`,
})

const emptyEditorConfig: DropZoneConfig = {
  resolve: (item, _target, ctx) =>
    operation('open', 'Open in editor', async () => {
      await ctx.navigateToItem(item.slug, true)
    }),
  canAcceptFiles: true,
  getHighlightId: () => EMPTY_EDITOR_DROP_TYPE,
}

const rootConfig: DropZoneConfig = {
  resolve: (item, _target, ctx) => {
    const name = ctx.campaignName || 'Root'

    if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
      const capability = evaluateRestore(actorFromContext(ctx), item, {
        parentId: null,
        parent: null,
      })
      const rejected = capabilityRejection(capability)
      if (rejected) return rejected
      return operation('restore', `Restore to "${name}"`, async () => {
        await ctx.restoreItems([item], null)
        toast.success('Item restored')
      })
    }

    if (item.parentId == null) return null

    const capability = evaluateMoveToParent(actorFromContext(ctx), item, {
      parentId: null,
      parent: null,
    })
    const rejected = capabilityRejection(capability)
    if (rejected) return rejected

    return operation('move', `Move to "${name}"`, async () => {
      await ctx.moveItems([item], null)
    })
  },
  canAcceptFiles: true,
  getHighlightId: () => SIDEBAR_ROOT_DROP_TYPE,
}

const folderConfig = typedConfig<ResolvedSidebarItemDropData>({
  resolve: (item, t, ctx) => {
    if (item._id === t._id) return null

    const folderId = t._id as Id<'sidebarItems'>

    if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
      const capability = evaluateRestore(actorFromContext(ctx), item, {
        parentId: folderId,
        parent: t,
        ancestorIds: t.ancestorIds,
      })
      const rejected = capabilityRejection(capability)
      if (rejected) return rejected
      return operation('restore', `Restore to "${t.name}"`, async () => {
        await ctx.restoreItems([item], folderId)
        toast.success('Item restored')
        ctx.setFolderOpen(folderId)
      })
    }

    if (item.parentId === t._id) return null

    const capability = evaluateMoveToParent(actorFromContext(ctx), item, {
      parentId: folderId,
      parent: t,
      ancestorIds: t.ancestorIds,
    })
    const rejected = capabilityRejection(capability)
    if (rejected) return rejected

    return operation('move', `Move to "${t.name}"`, async () => {
      await ctx.moveItems([item], folderId)
      ctx.setFolderOpen(folderId)
    })
  },
  canAcceptFiles: (t) => t.location !== SIDEBAR_ITEM_LOCATION.trash,
  getHighlightId: (t) => t._id,
  getTargetKey: (raw) => raw.sidebarItemId as string,
})

const noteEditorConfig = typedConfig<NoteEditorDropZoneData>({
  resolve: (item) => {
    if (item.location === SIDEBAR_ITEM_LOCATION.trash) return rejection('trashed_item')
    return operation('link', 'Add link here')
  },
  canAcceptFiles: false,
  getHighlightId: (t) => `note:${t.noteId}`,
  getTargetKey: (raw) => `note:${String(raw.noteId)}`,
})

const canvasConfig = typedConfig<CanvasDropZoneData>({
  resolve: (item, target) => {
    if (item.location === SIDEBAR_ITEM_LOCATION.trash) return rejection('trashed_item')
    if ((item._id as string) === (target.canvasId as string)) return rejection('self_embed')
    return operation('embed', 'Add to canvas')
  },
  canAcceptFiles: true,
  getHighlightId: (t) => `canvas:${t.canvasId}`,
  getTargetKey: (raw) => `canvas:${String(raw.canvasId)}`,
})

const nonFolderItemConfig = typedConfig<ResolvedSidebarItemDropData>({
  resolve: () => null,
  canAcceptFiles: false,
  getHighlightId: (t) => t._id,
  getTargetKey: (raw) => raw.sidebarItemId as string,
})

// ─── Registry ───────────────────────────────────────────────────────

type DropZoneType =
  | typeof CANVAS_DROP_ZONE_TYPE
  | typeof TRASH_DROP_ZONE_TYPE
  | typeof MAP_DROP_ZONE_TYPE
  | typeof NOTE_EDITOR_DROP_TYPE
  | typeof EMPTY_EDITOR_DROP_TYPE
  | typeof SIDEBAR_ROOT_DROP_TYPE
  | SidebarItemType

const DROP_ZONE_REGISTRY: Record<DropZoneType, DropZoneConfig> = {
  [CANVAS_DROP_ZONE_TYPE]: canvasConfig,
  [TRASH_DROP_ZONE_TYPE]: trashConfig,
  [MAP_DROP_ZONE_TYPE]: mapConfig,
  [NOTE_EDITOR_DROP_TYPE]: noteEditorConfig,
  [EMPTY_EDITOR_DROP_TYPE]: emptyEditorConfig,
  [SIDEBAR_ROOT_DROP_TYPE]: rootConfig,
  [SIDEBAR_ITEM_TYPES.folders]: folderConfig,
  [SIDEBAR_ITEM_TYPES.notes]: nonFolderItemConfig,
  [SIDEBAR_ITEM_TYPES.gameMaps]: nonFolderItemConfig,
  [SIDEBAR_ITEM_TYPES.files]: nonFolderItemConfig,
  [SIDEBAR_ITEM_TYPES.canvases]: nonFolderItemConfig,
}

// ─── Dispatch Functions ─────────────────────────────────────────────

export function resolveDropOutcome(
  item: AnySidebarItem | null,
  target: SidebarDropData | null,
  ctx: DndContext,
): DropOutcome | null {
  if (!item || !target) return null
  const config = DROP_ZONE_REGISTRY[target.type]
  const outcome = config.resolve(item, target, ctx)
  if (!outcome || outcome.type === 'rejection') return outcome
  // Source permission: move/trash/restore require FULL_ACCESS on the item
  if (
    (outcome.action === 'move' || outcome.action === 'trash' || outcome.action === 'restore') &&
    item.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS
  ) {
    return rejection('no_permission')
  }
  return outcome
}

export function getDroppableMoveItems(
  items: Array<AnySidebarItem>,
  target: SidebarDropData,
  ctx: DndContext,
): DroppableMoveItemsResult {
  if (target.type !== SIDEBAR_ROOT_DROP_TYPE && target.type !== SIDEBAR_ITEM_TYPES.folders) {
    return { status: 'none' }
  }

  const parentId = target.type === SIDEBAR_ITEM_TYPES.folders ? target._id : null
  const resolvedItems: Array<ResolvedMoveDropItem> = items.map((item) => ({
    item,
    outcome: resolveDropOutcome(item, target, ctx),
  }))

  if (resolvedItems.length === 0) return { status: 'none' }
  if (resolvedItems.some(({ outcome }) => outcome?.type === 'rejection'))
    return { status: 'blocked' }

  const operations: Array<MoveDropOperation> = []
  for (const { item, outcome } of resolvedItems) {
    if (!outcome) continue
    if (outcome.type !== 'operation') return { status: 'blocked' }
    if (!isMoveDropAction(outcome.action)) return { status: 'none' }
    operations.push({ item, action: outcome.action })
  }

  if (operations.length === 0) return { status: 'noop' }

  const action = operations[0].action
  if (operations.some((op) => op.action !== action)) return { status: 'blocked' }

  return {
    status: 'ready',
    action,
    items: operations.map(({ item }) => item),
    parentId,
  }
}

export function canDropFilesOnTarget(target: SidebarDropData | null): boolean {
  if (!target) return false
  const config = DROP_ZONE_REGISTRY[target.type]
  return typeof config.canAcceptFiles === 'function'
    ? config.canAcceptFiles(target)
    : config.canAcceptFiles
}

export function getDropTargetKey(target: Record<string, unknown> | null): string | null {
  if (!target) return null
  const type = target.type as string
  const config = DROP_ZONE_REGISTRY[type as DropZoneType]
  if (!config) return null
  return config.getTargetKey?.(target) ?? type
}

export function getHighlightId(target: SidebarDropData | null): string | null {
  if (!target) return null
  return DROP_ZONE_REGISTRY[target.type].getHighlightId(target)
}

export function resolveDropTarget(
  rawData: Record<string, unknown>,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  trashedItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  getAncestorIds: (id: Id<'sidebarItems'>) => Array<Id<'sidebarItems'>>,
): SidebarDropData | null {
  if ('sidebarItemId' in rawData) {
    const sid = rawData.sidebarItemId as Id<'sidebarItems'>
    const item = itemsMap.get(sid) ?? trashedItemsMap.get(sid)
    if (!item) return null
    return { ...item, ancestorIds: getAncestorIds(item._id) }
  }
  const type = rawData.type
  if (typeof type !== 'string' || !(type in DROP_ZONE_REGISTRY)) return null
  return rawData as SidebarDropData
}
