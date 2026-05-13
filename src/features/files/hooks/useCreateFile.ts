import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemColor } from 'convex/sidebarItems/validation/color'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
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
    const created = await createItem({
      type: SIDEBAR_ITEM_TYPES.files,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
      parentTarget: args.parentTarget,
    })

    await updateFileStorage.mutateAsync({
      fileId: created.id,
      storageId: args.storageId,
    })

    return created
  }

  return { createFile }
}
