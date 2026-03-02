import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { toast } from 'sonner'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'

// ─── Constants ───────────────────────────────────────────────────────

export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const
export const TRASH_DROP_ZONE_TYPE = 'trash-drop-zone' as const

// ─── Types ───────────────────────────────────────────────────────────

export type SidebarDragData = {
  sidebarItemId: SidebarItemId
}

/** Type-safe extraction of sidebarItemId from raw drag source data. */
export function getDragItemId(
  sourceData: Record<string, unknown>,
): SidebarItemId | null {
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

export interface MapDropZoneData {
  [key: string | symbol]: unknown
  type: typeof MAP_DROP_ZONE_TYPE
  mapId: Id<'gameMaps'>
  mapName: string
  pinnedItemIds?: ReadonlyArray<SidebarItemId>
}

export interface SidebarRootDropZoneData {
  [key: string | symbol]: unknown
  type: typeof SIDEBAR_ROOT_TYPE
}

export interface EmptyEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof EMPTY_EDITOR_DROP_TYPE
}

export interface TrashDropZoneData {
  [key: string | symbol]: unknown
  type: typeof TRASH_DROP_ZONE_TYPE
}

export type SidebarDropData =
  | ResolvedSidebarItemDropData
  | SidebarRootDropZoneData
  | EmptyEditorDropZoneData
  | MapDropZoneData
  | TrashDropZoneData

export type DragDropAction =
  | 'move'
  | 'trash'
  | 'restore'
  | 'pin'
  | 'open'
  | null

export type DropRejectionReason =
  | 'self_pin'
  | 'already_pinned'
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'
  | 'trashed_folder'
  | 'name_conflict'
  | 'dm_only'

export type DropValidationResult =
  | { valid: true }
  | { valid: false; reason: DropRejectionReason }

// ─── Execution Context ───────────────────────────────────────────────

export interface DndContext {
  moveItem: (
    item: AnySidebarItem,
    options: { parentId?: Id<'folders'> | null; deleted?: boolean },
  ) => Promise<unknown>
  navigateToItem: (
    item: { type: SidebarItemType; slug: string },
    replace?: boolean,
  ) => Promise<void>
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

// ─── Drop Zone Config ────────────────────────────────────────────────

export interface DropZoneConfig<T extends SidebarDropData = SidebarDropData> {
  action: (item: AnySidebarItem, target: T) => DragDropAction
  validate: (
    item: AnySidebarItem,
    target: T,
    ctx: DndContext,
  ) => DropValidationResult
  wouldHaveEffect: (item: AnySidebarItem, target: T) => boolean
  getLabel: (
    action: DragDropAction,
    target: T,
    ctx: DndContext,
  ) => string | null
  execute:
    | ((
        item: AnySidebarItem,
        target: T,
        ctx: DndContext,
      ) => Promise<void>)
    | null
  canAcceptFiles: boolean | ((target: T) => boolean)
  getHighlightId: (target: T) => string | null
  getTargetKey?: (rawTarget: Record<string, unknown>) => string
}

/** Creates a typed config — T is erased for the registry but enforced within methods. */
function typedConfig<T extends SidebarDropData>(c: DropZoneConfig<T>): DropZoneConfig {
  return c as DropZoneConfig
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getActionVerb(action: DragDropAction): string {
  switch (action) {
    case 'restore':
      return 'Restore to'
    case 'pin':
      return 'Pin to'
    case 'open':
      return 'Open in'
    case 'move':
    case 'trash':
    case null:
      return 'Move to'
  }
}

export function rejectionReasonMessage(reason: DropRejectionReason): string {
  switch (reason) {
    case 'no_permission':
      return 'No permission to move here'
    case 'circular':
      return 'Cannot move folder into itself'
    case 'self_pin':
      return 'Cannot pin map to itself'
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
  }
}

// ─── Configs ─────────────────────────────────────────────────────────

const trashConfig: DropZoneConfig = {
  action: () => 'trash',
  validate: (item, _target, ctx) => {
    if (item.type === SIDEBAR_ITEM_TYPES.folders && !ctx.isDm) {
      return { valid: false, reason: 'dm_only' }
    }
    return { valid: true }
  },
  wouldHaveEffect: (item) => !item.deletionTime,
  getLabel: () => 'Move to "Trash"',
  execute: async (item, _target, ctx) => {
    await ctx.moveItem(item, { deleted: true })
    toast.success('Moved to trash')
  },
  canAcceptFiles: false,
  getHighlightId: () => TRASH_DROP_ZONE_TYPE,
}

const mapConfig = typedConfig<MapDropZoneData>({
  action: () => 'pin',
  validate: (item, t) => {
    if (item.type === SIDEBAR_ITEM_TYPES.gameMaps && item._id === t.mapId) {
      return { valid: false, reason: 'self_pin' }
    }
    if (t.pinnedItemIds?.includes(item._id)) {
      return { valid: false, reason: 'already_pinned' }
    }
    return { valid: true }
  },
  wouldHaveEffect: () => true,
  getLabel: (_action, t) => `Pin to "${t.mapName}"`,
  execute: null, // handled by map component
  canAcceptFiles: false,
  getHighlightId: (t) => `map:${t.mapId}`,
  getTargetKey: (raw) => `map:${raw.mapId}`,
})

const emptyEditorConfig: DropZoneConfig = {
  action: () => 'open',
  validate: () => ({ valid: true }),
  wouldHaveEffect: () => true,
  getLabel: () => 'Open in editor',
  execute: async (item, _target, ctx) => {
    await ctx.navigateToItem(item, true)
  },
  canAcceptFiles: true,
  getHighlightId: () => EMPTY_EDITOR_DROP_TYPE,
}

const rootConfig: DropZoneConfig = {
  action: (item) => (item.deletionTime ? 'restore' : 'move'),
  validate: (item, _target, ctx) => {
    if (item.deletionTime) {
      if (item.type === SIDEBAR_ITEM_TYPES.folders && !ctx.isDm) {
        return { valid: false, reason: 'dm_only' }
      }
    }
    if (ctx.hasSiblingNameConflict(item.name, null, item._id)) {
      return { valid: false, reason: 'name_conflict' }
    }
    return { valid: true }
  },
  wouldHaveEffect: (item) => {
    if (item.deletionTime) return true
    return item.parentId != null
  },
  getLabel: (action, _target, ctx) => {
    const name = ctx.campaignName || 'Root'
    return `${getActionVerb(action)} "${name}"`
  },
  execute: async (item, _target, ctx) => {
    const deleted = item.deletionTime ? false : undefined
    await ctx.moveItem(item, { parentId: null, deleted })
    if (item.deletionTime) toast.success('Item restored')
  },
  canAcceptFiles: true,
  getHighlightId: () => SIDEBAR_ROOT_TYPE,
}

const folderConfig = typedConfig<ResolvedSidebarItemDropData>({
  action: (item, t) => {
    if (item.deletionTime && !t.deletionTime) return 'restore'
    return 'move'
  },
  validate: (item, t, ctx) => {
    if (t.deletionTime) return { valid: false, reason: 'trashed_folder' }
    if (t._id === item._id) return { valid: true }
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      t.ancestorIds?.includes(item._id)
    ) {
      return { valid: false, reason: 'circular' }
    }
    if (t.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS) {
      return { valid: false, reason: 'no_permission' }
    }
    if (item.deletionTime && !t.deletionTime) {
      if (item.type === SIDEBAR_ITEM_TYPES.folders && !ctx.isDm) {
        return { valid: false, reason: 'dm_only' }
      }
    }
    if (
      ctx.hasSiblingNameConflict(item.name, t._id as Id<'folders'>, item._id)
    ) {
      return { valid: false, reason: 'name_conflict' }
    }
    return { valid: true }
  },
  wouldHaveEffect: (item, t) => {
    if (item._id === t._id) return false
    if (!!item.deletionTime !== !!t.deletionTime) return true
    return item.parentId !== t._id
  },
  getLabel: (action, t) => `${getActionVerb(action)} "${t.name}"`,
  execute: async (item, t, ctx) => {
    const action = folderConfig.action(item, t)
    const deleted = action === 'restore' ? false : undefined
    const folderId = t._id as Id<'folders'>
    await ctx.moveItem(item, { parentId: folderId, deleted })
    if (action === 'restore') toast.success('Item restored')
    ctx.setFolderOpen(folderId)
  },
  canAcceptFiles: (t) => !t.deletionTime,
  getHighlightId: (t) => t._id,
  getTargetKey: (raw) => raw.sidebarItemId as string,
})

const nonFolderItemConfig = typedConfig<ResolvedSidebarItemDropData>({
  action: () => 'move',
  validate: () => ({ valid: false, reason: 'not_folder' }),
  wouldHaveEffect: () => false,
  getLabel: () => null,
  execute: null,
  canAcceptFiles: false,
  getHighlightId: (t) => t._id,
  getTargetKey: (raw) => raw.sidebarItemId as string,
})

// ─── Registry ────────────────────────────────────────────────────────

type DropZoneType =
  | typeof TRASH_DROP_ZONE_TYPE
  | typeof MAP_DROP_ZONE_TYPE
  | typeof EMPTY_EDITOR_DROP_TYPE
  | typeof SIDEBAR_ROOT_TYPE
  | SidebarItemType

export const DROP_ZONE_REGISTRY: Record<DropZoneType, DropZoneConfig> = {
  [TRASH_DROP_ZONE_TYPE]: trashConfig,
  [MAP_DROP_ZONE_TYPE]: mapConfig,
  [EMPTY_EDITOR_DROP_TYPE]: emptyEditorConfig,
  [SIDEBAR_ROOT_TYPE]: rootConfig,
  [SIDEBAR_ITEM_TYPES.folders]: folderConfig,
  [SIDEBAR_ITEM_TYPES.notes]: nonFolderItemConfig,
  [SIDEBAR_ITEM_TYPES.gameMaps]: nonFolderItemConfig,
  [SIDEBAR_ITEM_TYPES.files]: nonFolderItemConfig,
}

// ─── Dispatch Functions ──────────────────────────────────────────────

export function getDragDropAction(
  item: AnySidebarItem | null,
  target: SidebarDropData | null,
): DragDropAction {
  if (!item || !target) return null
  return DROP_ZONE_REGISTRY[target.type].action(item, target)
}

export function validateDrop(
  item: AnySidebarItem | null,
  target: SidebarDropData | null,
  ctx: DndContext,
): DropValidationResult {
  if (!item || !target) return { valid: false, reason: 'missing_data' }
  const config = DROP_ZONE_REGISTRY[target.type]
  const action = config.action(item, target)
  // Source item permission: move/trash/restore require FULL_ACCESS
  if (
    (action === 'move' || action === 'trash' || action === 'restore') &&
    item.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS
  ) {
    return { valid: false, reason: 'no_permission' }
  }
  return config.validate(item, target, ctx)
}

export function wouldDropHaveEffect(
  item: AnySidebarItem | null,
  target: SidebarDropData | null,
): boolean {
  if (!item || !target) return false
  return DROP_ZONE_REGISTRY[target.type].wouldHaveEffect(item, target)
}

export function getDropLabel(
  action: DragDropAction,
  target: SidebarDropData,
  ctx: DndContext,
): string | null {
  return DROP_ZONE_REGISTRY[target.type].getLabel(action, target, ctx)
}

export function canDropFilesOnTarget(target: SidebarDropData | null): boolean {
  if (!target) return false
  const config = DROP_ZONE_REGISTRY[target.type]
  return typeof config.canAcceptFiles === 'function'
    ? config.canAcceptFiles(target)
    : config.canAcceptFiles
}

export function getDropTargetKey(
  target: Record<string, unknown> | null,
): string | null {
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
  return rawData as SidebarDropData
}
