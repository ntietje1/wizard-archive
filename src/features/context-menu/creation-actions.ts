import type { ActionHandlers } from './menu-registry'
import type { MenuContext } from './types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { handleError } from '~/shared/utils/logger'
import type {
  SidebarItemCreationCommand,
  SidebarItemCreationType,
} from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '~/features/sidebar/sidebar-item-creation-catalog'

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
    type: SidebarItemCreationType
    campaignId: Id<'campaigns'>
    parentTarget: { kind: 'direct'; parentId: Id<'sidebarItems'> | null }
    name: string
  }) => Promise<{ id: Id<'sidebarItems'>; slug: SidebarItemSlug }>
  getDefaultName: (type: SidebarItemCreationType, parentId: Id<'sidebarItems'> | null) => string
  openParentFolders: (itemId: Id<'sidebarItems'>) => void
  navigateToItem: (slug: SidebarItemSlug) => Promise<void>
}): CreationActions {
  const createSidebarItem = async (ctx: MenuContext, command: SidebarItemCreationCommand) => {
    if (!campaignId) {
      handleError(new Error('Missing campaign id'), command.failureMessage)
      return
    }
    if (ctx.item && !isFolder(ctx.item)) {
      handleError(new Error('Invalid parent type'), command.failureMessage)
      return
    }
    const parentId = ctx.item?._id ?? null
    try {
      const result = await createItem({
        type: command.type,
        campaignId,
        parentTarget: { kind: 'direct', parentId },
        name: getDefaultName(command.type, parentId),
      })
      openParentFolders(result.id)
      await navigateToItem(result.slug)
    } catch (error) {
      handleError(error, command.failureMessage)
    }
  }

  return {
    createNote: (ctx) => createSidebarItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note']),
    createFolder: (ctx) =>
      createSidebarItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.folder']),
    createMap: (ctx) => createSidebarItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.map']),
    createCanvas: (ctx) =>
      createSidebarItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.canvas']),
    createFile: (ctx) => createSidebarItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.file']),
  }
}
