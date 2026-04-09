import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { validatePinTarget } from 'convex/gameMaps/validation'
import { toast } from 'sonner'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  SidebarItemId,
  SidebarItemLocation,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
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

export type SidebarDragData = {
  sidebarItemId: SidebarItemId
}

/** Type-safe extraction of sidebarItemId from raw drag source data. */
export function getDragItemId(sourceData: Record<string, unknown>): SidebarItemId | null {
  const id = sourceData.sidebarItemId
  return typeof id === 'string' ? (id as SidebarItemId) : null
}

export type SidebarItemDropData = {
  type: AnySidebarItem['type']
  sidebarItemId: SidebarItemId
}

export type ResolvedSidebarItemDropData = AnySidebarItem & {
  ancestorIds?: Array<Id<'folders'>>
}

export interface CanvasDropZoneData {
  [key: string | symbol]: unknown
  type: typeof CANVAS_DROP_ZONE_TYPE
  canvasId: Id<'canvases'>
}

export interface MapDropZoneData {
  [key: string | symbol]: unknown
  type: typeof MAP_DROP_ZONE_TYPE
  mapId: Id<'gameMaps'>
  mapName: string
  pinnedItemIds?: ReadonlyArray<SidebarItemId>
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
  noteId: Id<'notes'>
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

export type DragDropAction = 'move' | 'trash' | 'restore' | 'pin' | 'embed' | 'open' | 'link' | null

export type DropRejectionReason =
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

export type OperationOutcome = {
  type: 'operation'
  action: Exclude<DragDropAction, null>
  label: string
  execute: (() => Promise<void>) | null
}

export type RejectionOutcome = {
  type: 'rejection'
  reason: DropRejectionReason
}

export type DropOutcome = OperationOutcome | RejectionOutcome

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

// ─── Execution Context ──────────────────────────────────────────────

export interface DndContext {
  moveItem: (
    item: AnySidebarItem,
    options: {
      parentId?: Id<'folders'> | null
      location?: SidebarItemLocation
    },
  ) => Promise<unknown>
  navigateToItem: (slug: string, replace?: boolean) => Promise<void>
  campaignId: Id<'campaigns'> | null
  campaignName: string | undefined
  isDm: boolean
  setFolderOpen: (folderId: Id<'folders'>) => void
  hasSiblingNameConflict: (
    name: string,
    parentId: Id<'folders'> | null,
    excludeId?: SidebarItemId,
  ) => boolean
}

// ─── Drop Zone Config ───────────────────────────────────────────────

export interface DropZoneConfig<T extends SidebarDropData = SidebarDropData> {
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
    if (item.type === SIDEBAR_ITEM_TYPES.folders && !ctx.isDm) {
      return rejection('dm_only')
    }
    if (item.location === SIDEBAR_ITEM_LOCATION.trash) return null
    return operation('trash', 'Move to "Trash"', async () => {
      await ctx.moveItem(item, { location: SIDEBAR_ITEM_LOCATION.trash })
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
      if (item.type === SIDEBAR_ITEM_TYPES.folders && !ctx.isDm) {
        return rejection('dm_only')
      }
      if (ctx.hasSiblingNameConflict(item.name, null, item._id)) {
        return rejection('name_conflict')
      }
      return operation('restore', `Restore to "${name}"`, async () => {
        await ctx.moveItem(item, {
          parentId: null,
          location: SIDEBAR_ITEM_LOCATION.sidebar,
        })
        toast.success('Item restored')
      })
    }

    if (item.parentId == null) return null

    if (ctx.hasSiblingNameConflict(item.name, null, item._id)) {
      return rejection('name_conflict')
    }
    return operation('move', `Move to "${name}"`, async () => {
      await ctx.moveItem(item, { parentId: null })
    })
  },
  canAcceptFiles: true,
  getHighlightId: () => SIDEBAR_ROOT_DROP_TYPE,
}

const folderConfig = typedConfig<ResolvedSidebarItemDropData>({
  resolve: (item, t, ctx) => {
    if (item._id === t._id) return null
    if (t.location === SIDEBAR_ITEM_LOCATION.trash) return rejection('trashed_folder')
    if (item.type === SIDEBAR_ITEM_TYPES.folders && t.ancestorIds?.includes(item._id)) {
      return rejection('circular')
    }
    if (t.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS) {
      return rejection('no_permission')
    }

    const folderId = t._id as Id<'folders'>

    if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
      if (item.type === SIDEBAR_ITEM_TYPES.folders && !ctx.isDm) {
        return rejection('dm_only')
      }
      if (ctx.hasSiblingNameConflict(item.name, folderId, item._id)) {
        return rejection('name_conflict')
      }
      return operation('restore', `Restore to "${t.name}"`, async () => {
        await ctx.moveItem(item, {
          parentId: folderId,
          location: SIDEBAR_ITEM_LOCATION.sidebar,
        })
        toast.success('Item restored')
        ctx.setFolderOpen(folderId)
      })
    }

    if (item.parentId === t._id) return null

    if (ctx.hasSiblingNameConflict(item.name, folderId, item._id)) {
      return rejection('name_conflict')
    }
    return operation('move', `Move to "${t.name}"`, async () => {
      await ctx.moveItem(item, { parentId: folderId })
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

export const DROP_ZONE_REGISTRY: Record<DropZoneType, DropZoneConfig> = {
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
  itemsMap: ReadonlyMap<SidebarItemId, AnySidebarItem>,
  trashedItemsMap: ReadonlyMap<SidebarItemId, AnySidebarItem>,
  getAncestorIds: (id: SidebarItemId) => Array<Id<'folders'>>,
): SidebarDropData | null {
  if ('sidebarItemId' in rawData) {
    const sid = rawData.sidebarItemId as SidebarItemId
    const item = itemsMap.get(sid) ?? trashedItemsMap.get(sid)
    if (!item) return null
    return { ...item, ancestorIds: getAncestorIds(item._id) }
  }
  const type = rawData.type
  if (typeof type !== 'string' || !(type in DROP_ZONE_REGISTRY)) return null
  return rawData as SidebarDropData
}
