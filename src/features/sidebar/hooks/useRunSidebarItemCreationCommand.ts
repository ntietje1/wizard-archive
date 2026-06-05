import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { handleError } from '~/shared/utils/logger'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'

interface RunSidebarItemCreationCommandOptions {
  parentId: Id<'sidebarItems'> | null
  name?: string
}

type RunSidebarItemCreationCommandResult = {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
} | null

export function useRunSidebarItemCreationCommand() {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()

  const runCreationCommand = async (
    command: SidebarItemCreationCommand,
    options: RunSidebarItemCreationCommandOptions,
  ): Promise<RunSidebarItemCreationCommandResult> => {
    if (!campaignId) return null

    try {
      const result = await createItem({
        type: command.type,
        parentTarget: { kind: 'direct', parentId: options.parentId },
        name: options.name ?? getDefaultName(command.type, options.parentId),
      })
      openParentFolders(result.id)
      await navigateToItem(result.slug)
      return result
    } catch (error) {
      handleError(error, command.failureMessage)
      return null
    }
  }

  return { runCreationCommand }
}
