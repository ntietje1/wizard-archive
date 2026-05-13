import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { coerceSidebarItemColorForInput } from 'convex/sidebarItems/validation/color'
import { coerceSidebarItemIconNameForInput } from 'convex/sidebarItems/validation/icon'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { Id } from 'convex/_generated/dataModel'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { validateCreateItemLocally } from 'convex/sidebarItems/validation/parent'
import { useFileSystem } from '~/features/filesystem/useFileSystem'

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
  const { itemsMap, parentItemsMap } = useActiveSidebarItems()
  const filesystem = useFileSystem()

  const validateCreateItem = (args: CreateItemArgs) => {
    return validateCreateItemLocally(
      {
        name: args.name,
        parentTarget: args.parentTarget,
      },
      itemsMap,
      parentItemsMap,
    )
  }

  const createItem = async (args: CreateItemArgs): Promise<CreateItemResult> => {
    const trimmedName = args.name.trim()
    const nameResult = validateCreateItem({
      ...args,
      name: trimmedName,
    })
    if (!nameResult.valid) {
      throw new Error(nameResult.error)
    }
    const normalizedName = assertSidebarItemName(trimmedName)

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
    return { id: created.id, slug: created.slug }
  }

  return { createItem, validateCreateItem }
}
