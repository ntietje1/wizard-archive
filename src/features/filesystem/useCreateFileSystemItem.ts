import type { CreateParentTarget } from 'shared/sidebar-items/parent-target'
import { coerceSidebarItemColorForInput } from 'shared/sidebar-items/color'
import { coerceSidebarItemIconNameForInput } from 'shared/sidebar-items/icon'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Id } from 'convex/_generated/dataModel'
import { validateCreateItemLocally } from 'shared/sidebar-items/parent-target'
import { createFileSystemReadModel } from 'shared/sidebar-items/filesystem/read-model'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import { deduplicateName } from 'shared/sidebar-items/default-name'
import { useFileSystemReadModel } from './useFileSystemReadModel'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { SIDEBAR_ITEMS_VIEW } from '~/features/sidebar/contexts/sidebar-items-context'

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
  const sidebarItemsCache = useSidebarItemsCache()

  const getCurrentReadModel = () => {
    const activeItems = sidebarItemsCache.get(SIDEBAR_ITEMS_VIEW.active)
    const trashItems = sidebarItemsCache.get(SIDEBAR_ITEMS_VIEW.trash)
    const cachedItems = [...activeItems, ...trashItems]
    return cachedItems.length > 0 ? createFileSystemReadModel(cachedItems) : readModel
  }

  const validateCreateItem = (args: CreateItemArgs) => {
    const currentReadModel = getCurrentReadModel()
    return validateCreateItemLocally(
      {
        name: args.name,
        parentTarget: args.parentTarget,
      },
      currentReadModel.itemsById,
      currentReadModel.activeChildrenByParent,
    )
  }

  const createItem = async (
    args: CreateItemArgs,
    initialize?: (created: CreateItemResult) => Promise<void> | void,
  ): Promise<CreateItemResult> => {
    const currentReadModel = getCurrentReadModel()
    const trimmedName = args.name.trim()
    const candidateName =
      args.parentTarget.kind === 'direct'
        ? deduplicateName(
            trimmedName,
            currentReadModel.getActiveChildren(args.parentTarget.parentId).map((item) => item.name),
          )
        : trimmedName
    const nameResult = validateCreateItemLocally(
      {
        name: candidateName,
        parentTarget: args.parentTarget,
      },
      currentReadModel.itemsById,
      currentReadModel.activeChildrenByParent,
    )
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
