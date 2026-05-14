import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemColor } from 'convex/sidebarItems/validation/color'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useFileSystem } from '~/features/filesystem/useFileSystem'

interface CreateMapArgs {
  name: string
  parentTarget: CreateParentTarget
  imageStorageId: Id<'_storage'>
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
}

export function useCreateMap() {
  const { createItem } = useCreateFileSystemItem()
  const filesystem = useFileSystem()
  const updateMapImage = useCampaignMutation(api.gameMaps.mutations.updateMapImage)

  const createMap = async (args: CreateMapArgs) => {
    const created = await createItem({
      type: SIDEBAR_ITEM_TYPES.gameMaps,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
      parentTarget: args.parentTarget,
    })

    try {
      await updateMapImage.mutateAsync({
        mapId: created.id,
        imageStorageId: args.imageStorageId,
      })
    } catch (error) {
      await filesystem.discardCreatedItem(created.transactionId)
      throw error
    }

    return created
  }

  return { createMap }
}
