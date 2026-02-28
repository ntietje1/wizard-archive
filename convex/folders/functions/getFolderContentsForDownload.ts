import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { getTopLevelBlocksByNote } from '../../blocks/functions/getTopLevelBlocksByNote'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { Id } from '../../_generated/dataModel'
import { assertNever } from '../../common/types'

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
  }: { parentId: Id<'folders'> | undefined; currentPath: string },
): Promise<Array<DownloadItem>> {
  const children = await getSidebarItemsByParent(ctx, { parentId })
  const items: Array<DownloadItem> = []
  const permissionLevels = await Promise.all(
    children.map((child) =>
      getSidebarItemPermissionLevel(ctx, { item: child }),
    ),
  )

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const level = permissionLevels[i]
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.VIEW)) continue

    switch (child.type) {
      case SIDEBAR_ITEM_TYPES.files: {
        const fileName = child.name
        const downloadUrl = child.storageId
          ? await ctx.storage.getUrl(child.storageId)
          : null
        items.push({
          type: SIDEBAR_ITEM_TYPES.files,
          name: fileName,
          path: currentPath ? `${currentPath}/${fileName}` : fileName,
          downloadUrl,
        })
        break
      }
      case SIDEBAR_ITEM_TYPES.notes: {
        const baseName = child.name
        const noteName = baseName.endsWith('.md')
          ? baseName
          : `${baseName}.md`
        const topLevelBlocks = await getTopLevelBlocksByNote(ctx, {
          noteId: child._id,
        })
        const visibleBlocks = await Promise.all(
          topLevelBlocks.map((block) =>
            enforceBlockSharePermissionsOrNull(ctx, { block }),
          ),
        )
        const content = visibleBlocks
          .filter(
            (block): block is NonNullable<typeof block> => block !== null,
          )
          .map((block) => block.content)
        items.push({
          type: SIDEBAR_ITEM_TYPES.notes,
          name: noteName,
          path: currentPath ? `${currentPath}/${noteName}` : noteName,
          content,
        })
        break
      }
      case SIDEBAR_ITEM_TYPES.gameMaps: {
        const mapName = child.name
        const downloadUrl = child.imageStorageId
          ? await ctx.storage.getUrl(child.imageStorageId)
          : null
        items.push({
          type: SIDEBAR_ITEM_TYPES.gameMaps,
          name: mapName,
          path: currentPath ? `${currentPath}/${mapName}` : mapName,
          downloadUrl,
        })
        break
      }
      case SIDEBAR_ITEM_TYPES.folders: {
        const folderName = child.name
        const nestedPath = currentPath
          ? `${currentPath}/${folderName}`
          : folderName
        const nestedItems = await collectItemsRecursively(ctx, {
          parentId: child._id,
          currentPath: nestedPath,
        })
        items.push(...nestedItems)
        break
      }
      default:
        assertNever(child)
    }
  }

  return items
}

export async function getFolderContentsForDownload(
  ctx: CampaignQueryCtx,
  folderId: Id<'folders'>,
): Promise<{ folderName: string; items: Array<DownloadItem> }> {
  const folderFromDb = await ctx.db.get(folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
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
    parentId: undefined,
    currentPath: '',
  })
  return { items }
}
