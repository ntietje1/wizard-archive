import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { coerceSidebarItemColorForInput } from 'convex/sidebarItems/validation/color'
import { coerceSidebarItemIconNameForInput } from 'convex/sidebarItems/validation/icon'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { Id } from 'convex/_generated/dataModel'
import { validateCreateItemLocally } from 'convex/sidebarItems/validation/parent'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import { deduplicateName } from 'convex/sidebarItems/functions/defaultItemName'
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
  transactionId: Id<'filesystemTransactions'>
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

  const createItem = async (args: CreateItemArgs): Promise<CreateItemResult> => {
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

    const created = await filesystem.createItem({
      itemType: args.type,
      name: normalizedName,
      parentTarget: args.parentTarget,
      iconName,
      color,
    })
    if (!created) {
      throw new Error(`Failed to create ${args.type}`)
    }
    return created
  }

  return { createItem, validateCreateItem }
}
