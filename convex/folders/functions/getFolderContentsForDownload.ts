import { ERROR_CODE, throwClientError } from '../../errors'
import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { getTopLevelBlocksByNote } from '../../blocks/functions/getTopLevelBlocksByNote'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { assertNever } from '../../common/types'
import type { AuthQueryCtx } from '../../functions'
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
  ctx: AuthQueryCtx,
  {
    campaignId,
    parentId,
    currentPath,
  }: {
    campaignId: Id<'campaigns'>
    parentId: Id<'folders'> | null
    currentPath: string
  },
): Promise<Array<DownloadItem>> {
  const children = await getSidebarItemsByParent(ctx, { campaignId, parentId })
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
        const noteName = baseName.endsWith('.md') ? baseName : `${baseName}.md`
        const topLevelBlocks = await getTopLevelBlocksByNote(ctx, {
          noteId: child._id,
        })
        const results = await Promise.all(
          topLevelBlocks.map((block) =>
            enforceBlockSharePermissionsOrNull(ctx, { block }),
          ),
        )
        const content = results
          .filter(
            (result): result is NonNullable<typeof result> => result !== null,
          )
          .map((result) => result.block.content)
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
          campaignId,
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
  ctx: AuthQueryCtx,
  folderId: Id<'folders'>,
): Promise<{ folderName: string; items: Array<DownloadItem> }> {
  const folderFromDb = await ctx.db.get(folderId)
  if (!folderFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder not found')
  const campaignId = folderFromDb.campaignId
  await requireCampaignMembership(ctx, campaignId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const folderName = folder.name
  const items = await collectItemsRecursively(ctx, {
    campaignId,
    parentId: folderId,
    currentPath: '',
  })

  return { folderName, items }
}

export async function getRootContentsForDownload(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<{ items: Array<DownloadItem> }> {
  await requireCampaignMembership(ctx, campaignId)
  const items = await collectItemsRecursively(ctx, {
    campaignId,
    parentId: null,
    currentPath: '',
  })
  return { items }
}
