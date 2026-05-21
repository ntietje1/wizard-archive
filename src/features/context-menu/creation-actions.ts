import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { ActionHandlers } from './menu-registry'
import type { MenuContext } from './types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { handleError } from '~/shared/utils/logger'

type CreationType =
  | typeof SIDEBAR_ITEM_TYPES.notes
  | typeof SIDEBAR_ITEM_TYPES.folders
  | typeof SIDEBAR_ITEM_TYPES.gameMaps
  | typeof SIDEBAR_ITEM_TYPES.files
  | typeof SIDEBAR_ITEM_TYPES.canvases

type CreationActions = Pick<
  ActionHandlers,
  'createNote' | 'createFolder' | 'createMap' | 'createFile' | 'createCanvas'
>

export function createCreationActions({
  campaignId,
  createItem,
  getDefaultName,
  openParentFolders,
  navigateToItem,
}: {
  campaignId: Id<'campaigns'> | undefined
  createItem: (args: {
    type: CreationType
    campaignId: Id<'campaigns'>
    parentTarget: { kind: 'direct'; parentId: Id<'sidebarItems'> | null }
    name: string
  }) => Promise<{ id: Id<'sidebarItems'>; slug: SidebarItemSlug }>
  getDefaultName: (type: CreationType, parentId: Id<'sidebarItems'> | null) => string
  openParentFolders: (itemId: Id<'sidebarItems'>) => void
  navigateToItem: (slug: SidebarItemSlug) => Promise<void>
}): CreationActions {
  const createSidebarItem = async (
    ctx: MenuContext,
    type: CreationType,
    failureMessage: string,
  ) => {
    if (!campaignId) {
      handleError(new Error('Missing campaign id'), failureMessage)
      return
    }
    if (ctx.item && !isFolder(ctx.item)) {
      handleError(new Error('Invalid parent type'), failureMessage)
      return
    }
    const parentId = ctx.item?._id ?? null
    try {
      const result = await createItem({
        type,
        campaignId,
        parentTarget: { kind: 'direct', parentId },
        name: getDefaultName(type, parentId),
      })
      openParentFolders(result.id)
      await navigateToItem(result.slug)
    } catch (error) {
      handleError(error, failureMessage)
    }
  }

  return {
    createNote: (ctx) => createSidebarItem(ctx, SIDEBAR_ITEM_TYPES.notes, 'Failed to create note'),
    createFolder: (ctx) =>
      createSidebarItem(ctx, SIDEBAR_ITEM_TYPES.folders, 'Failed to create folder'),
    createMap: (ctx) => createSidebarItem(ctx, SIDEBAR_ITEM_TYPES.gameMaps, 'Failed to create map'),
    createFile: (ctx) => createSidebarItem(ctx, SIDEBAR_ITEM_TYPES.files, 'Failed to create file'),
    createCanvas: (ctx) =>
      createSidebarItem(ctx, SIDEBAR_ITEM_TYPES.canvases, 'Failed to create canvas'),
  }
}
