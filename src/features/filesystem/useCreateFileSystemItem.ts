import type { CreateParentTarget } from 'shared/sidebar-items/parent-target'
import { coerceSidebarItemColorForInput } from 'shared/sidebar-items/color'
import { coerceSidebarItemIconNameForInput } from 'shared/sidebar-items/icon'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Id } from 'convex/_generated/dataModel'
import { validateCreateItemLocally } from 'shared/sidebar-items/parent-target'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import { deduplicateName } from 'shared/sidebar-items/default-name'
import { useFileSystemReadModel } from './useFileSystemReadModel'

interface CreateItemBase {
  name: string
  parentTarget: CreateParentTarget
  iconName?: string
  color?: string
}

export type CreateItemArgs = CreateItemBase & {
  type: SidebarItemType
}

type CreateItemResult = {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
}

export function useCreateFileSystemItem() {
  const { readModel } = useFileSystemReadModel()
  const filesystem = useFileSystem()

  const validateCreateItem = (args: CreateItemArgs) => {
    return validateCreateItemLocally(
      {
        name: args.name,
        parentTarget: args.parentTarget,
      },
      readModel.itemsById,
      readModel.activeChildrenByParent,
    )
  }

  const createItem = async (
    args: CreateItemArgs,
    initialize?: (created: CreateItemResult) => Promise<void> | void,
  ): Promise<CreateItemResult> => {
    const trimmedName = args.name.trim()
    const candidateName =
      args.parentTarget.kind === 'direct'
        ? deduplicateName(
            trimmedName,
            readModel.getActiveChildren(args.parentTarget.parentId).map((item) => item.name),
          )
        : trimmedName
    const nameResult = validateCreateItem({
      ...args,
      name: candidateName,
    })
    if (!nameResult.valid) {
      throw new Error(nameResult.error)
    }
    const normalizedName = assertSidebarItemName(candidateName)

    const iconName =
      args.iconName === undefined ? undefined : coerceSidebarItemIconNameForInput(args.iconName)

    const color = args.color === undefined ? undefined : coerceSidebarItemColorForInput(args.color)

    const created = await filesystem.createItem(
      {
        itemType: args.type,
        name: normalizedName,
        parentTarget: args.parentTarget,
        iconName,
        color,
      },
      initialize,
    )
    if (!created) {
      throw new Error(`Failed to create ${args.type}`)
    }
    return created
  }

  return { createItem, validateCreateItem }
}
