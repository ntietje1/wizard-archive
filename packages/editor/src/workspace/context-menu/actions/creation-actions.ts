import type { ResourceId } from '../../../resources/domain-id'
import type { WorkspaceMenuContext } from '../../menu-context'
import { isFolderItem } from '../../sidebar/utils/sidebar-item-types'
import { handleError } from '../../../errors/handle-error'
import type { SidebarItemCreationCommand } from '../../sidebar/creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '../../sidebar/creation-catalog'
import type { WorkspaceCreationContextMenuActions } from '../creation-menu'
import { CREATE_PARENT_TARGET_KIND } from '../../items'
import type { CreateParentTarget } from '../../items'
import type { ResourceKind } from '../../resource-contract'

import type { MaybePromise } from '../../../../../../shared/common/async'

import type { WorkspaceNavigation } from '../../runtime'
import type { FileSystemCreateItemResult } from '../../../filesystem/item-operation-contracts'
type CreateContextMenuItem = (input: {
  name?: string
  type: ResourceKind
  parentTarget: CreateParentTarget
}) => MaybePromise<FileSystemCreateItemResult>

export function createCreationActions({
  createItem: runCreateItem,
  openItem,
  setRenamingItemId,
}: {
  createItem: CreateContextMenuItem
  openItem: WorkspaceNavigation['openItem']
  setRenamingItemId: (itemId: ResourceId | null) => void
}): WorkspaceCreationContextMenuActions {
  const createItem = async (ctx: WorkspaceMenuContext, command: SidebarItemCreationCommand) => {
    if (ctx.item && !isFolderItem(ctx.item)) {
      handleError(new Error('Invalid parent type'), command.failureMessage)
      return
    }
    const parentId = ctx.item?.id ?? null
    try {
      const created = await runCreateItem({
        name: command.defaultName,
        type: command.type,
        parentTarget: { kind: CREATE_PARENT_TARGET_KIND.direct, parentId },
      })
      if (created.status !== 'completed') {
        handleError(new Error(`Creation failed: ${created.status}`), command.failureMessage)
        return
      }
      await openItem(created.id)
      setRenamingItemId(created.id)
    } catch (error) {
      handleError(error, command.failureMessage)
    }
  }

  return {
    createNote: (ctx) => createItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note']),
    createFolder: (ctx) => createItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.folder']),
    createMap: (ctx) => createItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.map']),
    createCanvas: (ctx) => createItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.canvas']),
    createFile: (ctx) => createItem(ctx, SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.file']),
  }
}
