import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { AnyItem } from '../workspace/items'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceCatalog } from '../filesystem/catalog'

export type DropTargetCatalog = Pick<ResourceCatalog, 'getKnownItemById' | 'getVisibleAncestors'>

export const CANVAS_DROP_ZONE_TYPE = 'canvas-drop-zone' as const
export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const EMPTY_EMBED_DROP_TYPE = 'empty-embed' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const
export const NOTE_EDITOR_DROP_TYPE = 'note-editor-drop' as const
export const SIDEBAR_ROOT_DROP_TYPE = 'root' as const
export const TRASH_DROP_ZONE_TYPE = 'trash-drop-zone' as const
const DND_RUNTIME_ID_FIELD = '__wizardArchiveDndRuntimeId' as const

const CUSTOM_DROP_ZONE_TYPES = [
  CANVAS_DROP_ZONE_TYPE,
  TRASH_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
] as const

const SIDEBAR_ITEM_DROP_TYPES = [
  RESOURCE_TYPES.folders,
  RESOURCE_TYPES.notes,
  RESOURCE_TYPES.gameMaps,
  RESOURCE_TYPES.files,
  RESOURCE_TYPES.canvases,
] as const

const IDLESS_DROP_ZONE_TYPES = [
  TRASH_DROP_ZONE_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
] as const

export type ResolvedSidebarItemDropData = AnyItem & {
  ancestorIds?: Array<SidebarItemId>
}

export interface CanvasDropZoneData {
  [key: string | symbol]: unknown
  type: typeof CANVAS_DROP_ZONE_TYPE
  canvasId: SidebarItemId
}

export interface MapDropZoneData {
  [key: string | symbol]: unknown
  type: typeof MAP_DROP_ZONE_TYPE
  mapId: SidebarItemId
  mapName: string
  pinnedItemIds?: ReadonlyArray<SidebarItemId>
}

interface SidebarRootDropZoneData {
  [key: string | symbol]: unknown
  type: typeof SIDEBAR_ROOT_DROP_TYPE
}

interface EmptyEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof EMPTY_EDITOR_DROP_TYPE
}

export interface EmptyEmbedDropZoneData {
  [key: string | symbol]: unknown
  type: typeof EMPTY_EMBED_DROP_TYPE
  sourceItemId: SidebarItemId
  embedBlockId: string
}

export interface NoteEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof NOTE_EDITOR_DROP_TYPE
  noteId: SidebarItemId
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
  | EmptyEmbedDropZoneData
  | MapDropZoneData
  | NoteEditorDropZoneData
  | TrashDropZoneData

type CustomSidebarDropData = Exclude<SidebarDropData, ResolvedSidebarItemDropData>

type DropZoneType =
  | (typeof CUSTOM_DROP_ZONE_TYPES)[number]
  | (typeof SIDEBAR_ITEM_DROP_TYPES)[number]

type ResolveDropTargetOptions = {
  runtimeId?: string | null
}

function isOneOf<const TValues extends ReadonlyArray<unknown>>(
  values: TValues,
  value: unknown,
): value is TValues[number] {
  return values.some((candidate) => candidate === value)
}

function isDropZoneType(type: unknown): type is DropZoneType {
  return isOneOf(CUSTOM_DROP_ZONE_TYPES, type) || isOneOf(SIDEBAR_ITEM_DROP_TYPES, type)
}

function isCustomDropZoneType(type: unknown): boolean {
  return isOneOf(CUSTOM_DROP_ZONE_TYPES, type)
}

function canUseTypeAsDropTargetKey(type: DropZoneType) {
  return isOneOf(IDLESS_DROP_ZONE_TYPES, type)
}

function getSidebarItemDropTargetKey(sidebarItemId: SidebarItemId): string {
  return `sidebar-item:${sidebarItemId}`
}

function getTargetValue(target: object, key: string): unknown {
  return (target as Record<string, unknown>)[key]
}

function customDropTargetKey(rawTarget: object, type: DropZoneType) {
  switch (type) {
    case CANVAS_DROP_ZONE_TYPE:
      return formatTargetIdKey('canvas', getTargetValue(rawTarget, 'canvasId'))
    case MAP_DROP_ZONE_TYPE:
      return formatTargetIdKey('map', getTargetValue(rawTarget, 'mapId'))
    case NOTE_EDITOR_DROP_TYPE:
      return formatTargetIdKey('note', getTargetValue(rawTarget, 'noteId'))
    case EMPTY_EMBED_DROP_TYPE:
      return formatEmptyEmbedTargetKey(
        getTargetValue(rawTarget, 'sourceItemId'),
        getTargetValue(rawTarget, 'embedBlockId'),
      )
    case RESOURCE_TYPES.folders:
    case RESOURCE_TYPES.notes:
    case RESOURCE_TYPES.gameMaps:
    case RESOURCE_TYPES.files:
    case RESOURCE_TYPES.canvases: {
      const sidebarItemId = getTargetValue(rawTarget, 'sidebarItemId')
      if (typeof sidebarItemId === 'string') {
        return getSidebarItemDropTargetKey(sidebarItemId as SidebarItemId)
      }
      const id = getTargetValue(rawTarget, 'id')
      return typeof id === 'string' ? getSidebarItemDropTargetKey(id as SidebarItemId) : null
    }
    default:
      return null
  }
}

function formatTargetIdKey(prefix: 'canvas' | 'map' | 'note', id: unknown) {
  return typeof id === 'string' ? `${prefix}:${id}` : null
}

function formatEmptyEmbedTargetKey(sourceItemId: unknown, embedBlockId: unknown) {
  return typeof sourceItemId === 'string' && typeof embedBlockId === 'string'
    ? `empty-embed:${sourceItemId}:${embedBlockId}`
    : null
}

export function getDropTargetKey(target: object | null): string | null {
  if (!target) return null
  const type = getTargetValue(target, 'type')
  if (!isDropZoneType(type)) return null
  const targetKey = customDropTargetKey(target, type)
  const unscopedKey = targetKey ?? (canUseTypeAsDropTargetKey(type) ? type : null)
  if (!unscopedKey) return null
  const runtimeId = getDropTargetRuntimeId(target)
  return runtimeId ? `runtime:${runtimeId}:${unscopedKey}` : unscopedKey
}

function getDropTargetRuntimeId(target: object | null): string | null {
  if (!target) return null
  const runtimeId = getTargetValue(target, DND_RUNTIME_ID_FIELD)
  return typeof runtimeId === 'string' ? runtimeId : null
}

export function dropTargetBelongsToRuntime(
  target: Record<string, unknown> | null,
  runtimeId: string | null,
): boolean {
  const targetRuntimeId = getDropTargetRuntimeId(target)
  return !targetRuntimeId || !runtimeId || targetRuntimeId === runtimeId
}

export function scopeDropTargetData<TData extends Record<string, unknown>>(
  data: TData,
  runtimeId: string | null,
): TData {
  if (!runtimeId || data[DND_RUNTIME_ID_FIELD] === runtimeId) return data
  return { ...data, [DND_RUNTIME_ID_FIELD]: runtimeId }
}

function resolveSidebarItemDropTarget(
  rawData: Record<string, unknown>,
  catalog: DropTargetCatalog,
): ResolvedSidebarItemDropData | null {
  if (isCustomDropZoneType(rawData.type)) return null

  const id = rawData.sidebarItemId as SidebarItemId
  const item = catalog.getKnownItemById(id)
  if (!item) return null
  return scopeDropTargetData(
    {
      ...item,
      ancestorIds: catalog.getVisibleAncestors(item.id).map((ancestor) => ancestor.id),
    },
    getDropTargetRuntimeId(rawData),
  )
}

function resolveMapDropTarget(rawData: Record<string, unknown>): MapDropZoneData | null {
  if (typeof rawData.mapId !== 'string' || typeof rawData.mapName !== 'string') return null

  return {
    type: MAP_DROP_ZONE_TYPE,
    mapId: rawData.mapId as SidebarItemId,
    mapName: rawData.mapName,
    pinnedItemIds: Array.isArray(rawData.pinnedItemIds)
      ? rawData.pinnedItemIds.filter((id): id is SidebarItemId => typeof id === 'string')
      : undefined,
  }
}

function preserveResolvedDropTargetRuntimeScope<TTarget extends CustomSidebarDropData>(
  target: TTarget,
  rawData: Record<string, unknown>,
): TTarget {
  return scopeDropTargetData(target, getDropTargetRuntimeId(rawData))
}

function resolveCustomDropTarget(rawData: Record<string, unknown>): CustomSidebarDropData | null {
  const target = resolveUnscopedCustomDropTarget(rawData)
  return target ? preserveResolvedDropTargetRuntimeScope(target, rawData) : null
}

function resolveUnscopedCustomDropTarget(
  rawData: Record<string, unknown>,
): CustomSidebarDropData | null {
  switch (rawData.type) {
    case CANVAS_DROP_ZONE_TYPE:
      return typeof rawData.canvasId === 'string'
        ? { type: CANVAS_DROP_ZONE_TYPE, canvasId: rawData.canvasId as SidebarItemId }
        : null
    case MAP_DROP_ZONE_TYPE:
      return resolveMapDropTarget(rawData)
    case NOTE_EDITOR_DROP_TYPE:
      return typeof rawData.noteId === 'string'
        ? { type: NOTE_EDITOR_DROP_TYPE, noteId: rawData.noteId as SidebarItemId }
        : null
    case EMPTY_EMBED_DROP_TYPE:
      return typeof rawData.sourceItemId === 'string' && typeof rawData.embedBlockId === 'string'
        ? {
            type: EMPTY_EMBED_DROP_TYPE,
            sourceItemId: rawData.sourceItemId as SidebarItemId,
            embedBlockId: rawData.embedBlockId,
          }
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
  catalog: DropTargetCatalog,
  options: ResolveDropTargetOptions = {},
): SidebarDropData | null {
  if (!dropTargetBelongsToRuntime(rawData, options.runtimeId ?? null)) return null
  if (typeof rawData.sidebarItemId === 'string') {
    return resolveSidebarItemDropTarget(rawData, catalog)
  }
  return resolveCustomDropTarget(rawData)
}
