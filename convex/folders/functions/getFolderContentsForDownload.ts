import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { getAllBlocksByNote } from '../../blocks/functions/getAllBlocksByNote'
import { reconstructBlockTree } from '../../blocks/functions/reconstructBlockTree'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { assertNever } from '../../common/types'
import type { CampaignQueryCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { Id } from '../../_generated/dataModel'

export type DownloadItem =
  | {
      type: typeof SIDEBAR_ITEM_TYPES.files | typeof SIDEBAR_ITEM_TYPES.gameMaps
      name: string
      path: string
      downloadUrl: string | null
    }
  | {
      type: typeof SIDEBAR_ITEM_TYPES.notes
      name: string
      path: string
      content: Array<CustomBlock>
    }

async function collectItemsRecursively(
  ctx: CampaignQueryCtx,
  {
    parentId,
    currentPath,
  }: {
    parentId: Id<'sidebarItems'> | null
    currentPath: string
  },
): Promise<Array<DownloadItem>> {
  const children = await getSidebarItemsByParent(ctx, { parentId })
  const items: Array<DownloadItem> = []
  const permissionLevels = await asyncMap(children, (child) =>
    getSidebarItemPermissionLevel(ctx, { item: child }),
  )
  const buildPath = (name: string) => (currentPath ? `${currentPath}/${name}` : name)

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const level = permissionLevels[i]
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.VIEW)) continue

    switch (child.type) {
      case SIDEBAR_ITEM_TYPES.files: {
        const downloadUrl = child.storageId ? await ctx.storage.getUrl(child.storageId) : null
        items.push({
          type: SIDEBAR_ITEM_TYPES.files,
          name: child.name,
          path: buildPath(child.name),
          downloadUrl,
        })
        break
      }
      case SIDEBAR_ITEM_TYPES.notes: {
        const noteName = child.name.endsWith('.md') ? child.name : `${child.name}.md`
        const allBlocks = await getAllBlocksByNote(ctx, {
          noteId: child._id,
        })
        const results = await asyncMap(allBlocks, (block) =>
          enforceBlockSharePermissionsOrNull(ctx, { block }),
        )
        const permittedBlocks = results
          .filter((result): result is NonNullable<typeof result> => result !== null)
          .map((result) => result.block)
        const content = reconstructBlockTree(permittedBlocks)
        items.push({
          type: SIDEBAR_ITEM_TYPES.notes,
          name: noteName,
          path: buildPath(noteName),
          content,
        })
        break
      }
      case SIDEBAR_ITEM_TYPES.gameMaps: {
        const downloadUrl = child.imageStorageId
          ? await ctx.storage.getUrl(child.imageStorageId)
          : null
        items.push({
          type: SIDEBAR_ITEM_TYPES.gameMaps,
          name: child.name,
          path: buildPath(child.name),
          downloadUrl,
        })
        break
      }
      case SIDEBAR_ITEM_TYPES.folders: {
        const nestedItems = await collectItemsRecursively(ctx, {
          parentId: child._id,
          currentPath: buildPath(child.name),
        })
        items.push(...nestedItems)
        break
      }
      // TODO: add canvas -> img export
      case SIDEBAR_ITEM_TYPES.canvases:
        break
      default:
        assertNever(child)
    }
  }

  return items
}

export async function getFolderContentsForDownload(
  ctx: CampaignQueryCtx,
  folderId: Id<'sidebarItems'>,
): Promise<{ folderName: string; items: Array<DownloadItem> }> {
  const rawItem = await getSidebarItem(ctx, folderId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder not found')
  if (rawItem.type !== SIDEBAR_ITEM_TYPES.folders)
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Item is not a folder')
  const folder = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const folderName = folder.name
  const items = await collectItemsRecursively(ctx, {
    parentId: folderId,
    currentPath: '',
  })

  return { folderName, items }
}

export async function getRootContentsForDownload(
  ctx: CampaignQueryCtx,
): Promise<{ items: Array<DownloadItem> }> {
  const items = await collectItemsRecursively(ctx, {
    parentId: null,
    currentPath: '',
  })
  return { items }
}
