import type { EditorContextMenuActionHandlers, MenuContext } from './types'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { handleError } from '~/shared/utils/logger'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '~/features/sidebar/sidebar-item-creation-catalog'
import type { SidebarWorkspaceCreateItem } from '~/features/sidebar/workspace/sidebar-workspace-source'

type CreationActions = Pick<
  EditorContextMenuActionHandlers,
  'createNote' | 'createFolder' | 'createMap' | 'createFile' | 'createCanvas'
>

export function createCreationActions({
  createSidebarItem: runCreateSidebarItem,
}: {
  createSidebarItem: SidebarWorkspaceCreateItem
}): CreationActions {
  const createSidebarItem = async (ctx: MenuContext, command: SidebarItemCreationCommand) => {
    if (ctx.item && !isFolder(ctx.item)) {
      handleError(new Error('Invalid parent type'), command.failureMessage)
      return
    }
    const parentId = ctx.item?._id ?? null
    try {
      await runCreateSidebarItem({ type: command.type, parentId })
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
