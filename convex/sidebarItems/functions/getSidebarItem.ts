import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { AnyResourceRow } from '@wizard-archive/editor/resources/resource-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { assertNever } from '../../common/types'
import { isUndoHiddenSidebarItem } from '../types/status'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { AssetId } from '../../../shared/common/ids'
type GetSidebarItemCtx = Pick<QueryCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
}

async function getSidebarItemExtension<TTable extends 'folders' | 'gameMaps' | 'files'>(
  ctx: GetSidebarItemCtx,
  table: TTable,
  itemId: Id<'sidebarItems'>,
): Promise<Doc<TTable> | null> {
  return await ctx.db
    .query(table)
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', itemId as never))
    .unique()
}

async function requireSidebarItemExtension<TTable extends 'folders' | 'gameMaps' | 'files'>(
  ctx: GetSidebarItemCtx,
  table: TTable,
  itemId: Id<'sidebarItems'>,
  label: string,
): Promise<Doc<TTable>> {
  const ext = await getSidebarItemExtension(ctx, table, itemId)
  if (!ext) throwClientError(ERROR_CODE.NOT_FOUND, `Missing ${label} extension row`)
  return ext
}

export async function getSidebarItem(
  ctx: GetSidebarItemCtx,
  id: Id<'sidebarItems'>,
): Promise<AnyResourceRow | null> {
  const raw = await ctx.db.get('sidebarItems', id)
  return raw ? getSidebarItemFromRaw(ctx, raw) : null
}

export async function getSidebarItemFromRaw(
  ctx: GetSidebarItemCtx,
  raw: Doc<'sidebarItems'>,
): Promise<AnyResourceRow | null> {
  if (raw.campaignId !== ctx.campaign._id || isUndoHiddenSidebarItem(raw)) return null
  switch (raw.type) {
    case RESOURCE_TYPES.folders: {
      const ext = await requireSidebarItemExtension(ctx, 'folders', raw._id, 'folder')
      return { ...toEditorResourceRow(raw), inheritShares: ext.inheritShares } as AnyResourceRow
    }
    case RESOURCE_TYPES.gameMaps: {
      const ext = await requireSidebarItemExtension(ctx, 'gameMaps', raw._id, 'game map')
      return {
        ...toEditorResourceRow(raw),
        imageAssetId: ext.imageStorageId as AssetId | null,
      } as AnyResourceRow
    }
    case RESOURCE_TYPES.files: {
      const ext = await requireSidebarItemExtension(ctx, 'files', raw._id, 'file')
      return {
        ...toEditorResourceRow(raw),
        assetId: ext.storageId as AssetId | null,
      } as AnyResourceRow
    }
    case RESOURCE_TYPES.notes:
      return toEditorResourceRow(raw) as AnyResourceRow
    case RESOURCE_TYPES.canvases:
      return toEditorResourceRow(raw) as AnyResourceRow
    default:
      return assertNever(raw.type)
  }
}

function toEditorResourceRow(row: Doc<'sidebarItems'>) {
  const {
    _id,
    _creationTime,
    previewStorageId,
    previewUpdatedAt: _previewUpdatedAt,
    ...fields
  } = row
  return {
    ...fields,
    id: _id,
    createdAt: _creationTime,
    previewAssetId: previewStorageId as AssetId | null,
  }
}
