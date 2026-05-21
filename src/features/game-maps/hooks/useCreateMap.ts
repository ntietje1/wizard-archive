import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemColor } from 'shared/sidebar-items/color'
import type { SidebarItemIconName } from 'shared/sidebar-items/icon'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

interface CreateMapArgs {
  name: string
  parentTarget: CreateParentTarget
  imageStorageId: Id<'_storage'>
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
}

export function useCreateMap() {
  const { createItem } = useCreateFileSystemItem()
  const updateMapImage = useCampaignMutation(api.gameMaps.mutations.updateMapImage)

  const createMap = async (args: CreateMapArgs) => {
    return await createItem(
      {
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        name: args.name,
        iconName: args.iconName,
        color: args.color,
        parentTarget: args.parentTarget,
      },
      async (created) => {
        await updateMapImage.mutateAsync({
          mapId: created.id,
          imageStorageId: args.imageStorageId,
        })
      },
    )
  }

  return { createMap }
}
