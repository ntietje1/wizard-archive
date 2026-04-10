import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { NoteFromDb } from '../../notes/types'
import type { FolderFromDb } from '../../folders/types'
import type { GameMapFromDb } from '../../gameMaps/types'
import type { FileFromDb } from '../../files/types'
import type { CanvasFromDb } from '../../canvases/types'
import type { AnySidebarItemFromDb } from '../types/types'

type RawSidebarItem = Doc<'sidebarItems'>
type Db = Pick<QueryCtx, 'db'>

export async function loadExtensionData(
  ctx: Pick<QueryCtx, 'db'>,
  items: Array<RawSidebarItem>,
): Promise<Array<AnySidebarItemFromDb>> {
  if (items.length === 0) return []

  const folderIds = items.filter((i) => i.type === SIDEBAR_ITEM_TYPES.folders).map((i) => i._id)
  const mapIds = items.filter((i) => i.type === SIDEBAR_ITEM_TYPES.gameMaps).map((i) => i._id)
  const fileIds = items.filter((i) => i.type === SIDEBAR_ITEM_TYPES.files).map((i) => i._id)

  const [folderExts, mapExts, fileExts] = await Promise.all([
    Promise.all(
      folderIds.map((id) =>
        ctx.db
          .query('folders')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', id))
          .unique(),
      ),
    ),
    Promise.all(
      mapIds.map((id) =>
        ctx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', id))
          .unique(),
      ),
    ),
    Promise.all(
      fileIds.map((id) =>
        ctx.db
          .query('files')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', id))
          .unique(),
      ),
    ),
  ])

  const folderExtMap = new Map(folderExts.filter(Boolean).map((ext) => [ext!.sidebarItemId, ext!]))
  const mapExtMap = new Map(mapExts.filter(Boolean).map((ext) => [ext!.sidebarItemId, ext!]))
  const fileExtMap = new Map(fileExts.filter(Boolean).map((ext) => [ext!.sidebarItemId, ext!]))

  return items.map((item) => {
    switch (item.type) {
      case SIDEBAR_ITEM_TYPES.folders: {
        const ext = folderExtMap.get(item._id)
        return { ...item, inheritShares: ext?.inheritShares ?? false } as AnySidebarItemFromDb
      }
      case SIDEBAR_ITEM_TYPES.gameMaps: {
        const ext = mapExtMap.get(item._id)
        return {
          ...item,
          imageStorageId: ext?.imageStorageId ?? null,
        } as AnySidebarItemFromDb
      }
      case SIDEBAR_ITEM_TYPES.files: {
        const ext = fileExtMap.get(item._id)
        return { ...item, storageId: ext?.storageId ?? null } as AnySidebarItemFromDb
      }
      default:
        return item as AnySidebarItemFromDb
    }
  })
}

export async function loadSingleExtensionData(
  ctx: Db,
  item: RawSidebarItem,
): Promise<AnySidebarItemFromDb> {
  const [result] = await loadExtensionData(ctx, [item])
  return result!
}

export async function getSidebarItem(
  ctx: Db,
  id: Id<'sidebarItems'>,
): Promise<AnySidebarItemFromDb | null> {
  const raw = await ctx.db.get('sidebarItems', id)
  if (!raw) return null
  return loadSingleExtensionData(ctx, raw)
}

export async function getNote(ctx: Db, id: Id<'sidebarItems'>): Promise<NoteFromDb | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.notes) return null
  return item as NoteFromDb
}

export async function getFolder(ctx: Db, id: Id<'sidebarItems'>): Promise<FolderFromDb | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.folders) return null
  return item as FolderFromDb
}

export async function getGameMap(ctx: Db, id: Id<'sidebarItems'>): Promise<GameMapFromDb | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.gameMaps) return null
  return item as GameMapFromDb
}

export async function getFileItem(ctx: Db, id: Id<'sidebarItems'>): Promise<FileFromDb | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.files) return null
  return item as FileFromDb
}

export async function getCanvas(ctx: Db, id: Id<'sidebarItems'>): Promise<CanvasFromDb | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item || item.type !== SIDEBAR_ITEM_TYPES.canvases) return null
  return item as CanvasFromDb
}
