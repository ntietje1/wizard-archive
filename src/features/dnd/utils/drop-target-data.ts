import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

export const CANVAS_DROP_ZONE_TYPE = 'canvas-drop-zone' as const
export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const
export const NOTE_EDITOR_DROP_TYPE = 'note-editor-drop' as const
export const SIDEBAR_ROOT_DROP_TYPE = 'root' as const
export const TRASH_DROP_ZONE_TYPE = 'trash-drop-zone' as const

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

interface SidebarRootDropZoneData {
  [key: string | symbol]: unknown
  type: typeof SIDEBAR_ROOT_DROP_TYPE
}

interface EmptyEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof EMPTY_EDITOR_DROP_TYPE
}

export interface NoteEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof NOTE_EDITOR_DROP_TYPE
  noteId: Id<'sidebarItems'>
}

interface TrashDropZoneData {
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

type DropZoneType =
  | typeof CANVAS_DROP_ZONE_TYPE
  | typeof TRASH_DROP_ZONE_TYPE
  | typeof MAP_DROP_ZONE_TYPE
  | typeof NOTE_EDITOR_DROP_TYPE
  | typeof EMPTY_EDITOR_DROP_TYPE
  | typeof SIDEBAR_ROOT_DROP_TYPE
  | SidebarItemType

function isDropZoneType(type: unknown): type is DropZoneType {
  return (
    type === CANVAS_DROP_ZONE_TYPE ||
    type === TRASH_DROP_ZONE_TYPE ||
    type === MAP_DROP_ZONE_TYPE ||
    type === NOTE_EDITOR_DROP_TYPE ||
    type === EMPTY_EDITOR_DROP_TYPE ||
    type === SIDEBAR_ROOT_DROP_TYPE ||
    type === SIDEBAR_ITEM_TYPES.folders ||
    type === SIDEBAR_ITEM_TYPES.notes ||
    type === SIDEBAR_ITEM_TYPES.gameMaps ||
    type === SIDEBAR_ITEM_TYPES.files ||
    type === SIDEBAR_ITEM_TYPES.canvases
  )
}

function isCustomDropZoneType(type: unknown): boolean {
  return (
    type === CANVAS_DROP_ZONE_TYPE ||
    type === TRASH_DROP_ZONE_TYPE ||
    type === MAP_DROP_ZONE_TYPE ||
    type === NOTE_EDITOR_DROP_TYPE ||
    type === EMPTY_EDITOR_DROP_TYPE ||
    type === SIDEBAR_ROOT_DROP_TYPE
  )
}

function customDropTargetKey(rawTarget: Record<string, unknown>, type: DropZoneType) {
  switch (type) {
    case CANVAS_DROP_ZONE_TYPE:
      return typeof rawTarget.canvasId === 'string' ? `canvas:${rawTarget.canvasId}` : null
    case MAP_DROP_ZONE_TYPE:
      return typeof rawTarget.mapId === 'string' ? `map:${rawTarget.mapId}` : null
    case NOTE_EDITOR_DROP_TYPE:
      return typeof rawTarget.noteId === 'string' ? `note:${rawTarget.noteId}` : null
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files:
    case SIDEBAR_ITEM_TYPES.canvases:
      return typeof rawTarget.sidebarItemId === 'string' ? rawTarget.sidebarItemId : null
    default:
      return null
  }
}

export function canDropFilesOnTarget(target: SidebarDropData | null): boolean {
  if (!target) return false
  switch (target.type) {
    case CANVAS_DROP_ZONE_TYPE:
    case EMPTY_EDITOR_DROP_TYPE:
    case NOTE_EDITOR_DROP_TYPE:
    case SIDEBAR_ROOT_DROP_TYPE:
      return true
    case SIDEBAR_ITEM_TYPES.folders:
      return !target.isTrashed
    default:
      return false
  }
}

export function getDropTargetKey(target: Record<string, unknown> | null): string | null {
  if (!target) return null
  const { type } = target
  if (!isDropZoneType(type)) return null
  return customDropTargetKey(target, type) ?? type
}

export function getHighlightId(target: SidebarDropData | null): string | null {
  if (!target) return null
  switch (target.type) {
    case CANVAS_DROP_ZONE_TYPE:
      return `canvas:${target.canvasId}`
    case MAP_DROP_ZONE_TYPE:
      return `map:${target.mapId}`
    case NOTE_EDITOR_DROP_TYPE:
      return `note:${target.noteId}`
    case EMPTY_EDITOR_DROP_TYPE:
    case SIDEBAR_ROOT_DROP_TYPE:
    case TRASH_DROP_ZONE_TYPE:
      return target.type
    default:
      return target._id
  }
}

function resolveSidebarItemDropTarget(
  rawData: Record<string, unknown>,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  trashedItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  getAncestorIds: (id: Id<'sidebarItems'>) => Array<Id<'sidebarItems'>>,
): ResolvedSidebarItemDropData | null {
  if (isCustomDropZoneType(rawData.type)) return null

  const id = rawData.sidebarItemId as Id<'sidebarItems'>
  const item = itemsMap.get(id) ?? trashedItemsMap.get(id)
  return item ? { ...item, ancestorIds: getAncestorIds(item._id) } : null
}

function resolveMapDropTarget(rawData: Record<string, unknown>): MapDropZoneData | null {
  if (typeof rawData.mapId !== 'string' || typeof rawData.mapName !== 'string') return null

  return {
    type: MAP_DROP_ZONE_TYPE,
    mapId: rawData.mapId as Id<'sidebarItems'>,
    mapName: rawData.mapName,
    pinnedItemIds: Array.isArray(rawData.pinnedItemIds)
      ? rawData.pinnedItemIds.filter((id): id is Id<'sidebarItems'> => typeof id === 'string')
      : undefined,
  }
}

function resolveCustomDropTarget(rawData: Record<string, unknown>): SidebarDropData | null {
  switch (rawData.type) {
    case CANVAS_DROP_ZONE_TYPE:
      return typeof rawData.canvasId === 'string'
        ? { type: CANVAS_DROP_ZONE_TYPE, canvasId: rawData.canvasId as Id<'sidebarItems'> }
        : null
    case MAP_DROP_ZONE_TYPE:
      return resolveMapDropTarget(rawData)
    case NOTE_EDITOR_DROP_TYPE:
      return typeof rawData.noteId === 'string'
        ? { type: NOTE_EDITOR_DROP_TYPE, noteId: rawData.noteId as Id<'sidebarItems'> }
        : null
    case EMPTY_EDITOR_DROP_TYPE:
      return { type: EMPTY_EDITOR_DROP_TYPE }
    case SIDEBAR_ROOT_DROP_TYPE:
      return { type: SIDEBAR_ROOT_DROP_TYPE }
    case TRASH_DROP_ZONE_TYPE:
      return { type: TRASH_DROP_ZONE_TYPE }
    default:
      return null
  }
}

export function resolveDropTarget(
  rawData: Record<string, unknown>,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  trashedItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  getAncestorIds: (id: Id<'sidebarItems'>) => Array<Id<'sidebarItems'>>,
): SidebarDropData | null {
  if (typeof rawData.sidebarItemId === 'string') {
    return resolveSidebarItemDropTarget(rawData, itemsMap, trashedItemsMap, getAncestorIds)
  }
  return resolveCustomDropTarget(rawData)
}
