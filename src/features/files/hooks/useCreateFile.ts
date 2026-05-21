import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemColor } from 'shared/sidebar-items/color'
import type { SidebarItemIconName } from 'shared/sidebar-items/icon'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

interface CreateFileArgs {
  name: string
  parentTarget: CreateParentTarget
  storageId: Id<'_storage'>
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
}

export function useCreateFile() {
  const { createItem } = useCreateFileSystemItem()
  const updateFileStorage = useCampaignMutation(api.files.mutations.updateFileStorage)

  const createFile = async (args: CreateFileArgs) => {
    return await createItem(
      {
        type: SIDEBAR_ITEM_TYPES.files,
        name: args.name,
        iconName: args.iconName,
        color: args.color,
        parentTarget: args.parentTarget,
      },
      async (created) => {
        await updateFileStorage.mutateAsync({
          fileId: created.id,
          storageId: args.storageId,
        })
      },
    )
  }

  return { createFile }
}
