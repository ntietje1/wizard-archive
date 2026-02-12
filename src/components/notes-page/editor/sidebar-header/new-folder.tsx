import { toast } from 'sonner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { Button } from '~/components/shadcn/ui/button'
import { FolderPlus } from '~/lib/icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function NewFolderButton() {
  const { createItem } = useSidebarItemMutations()
  const { campaignWithMembership } = useCampaign()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleNewFolder = () => {
    if (!campaignId) return
    try {
      const result = createItem({
        type: SIDEBAR_ITEM_TYPES.folders,
        campaignId,
      })
      if (result) {
        openParentFolders(result.tempId)
        navigateToItem(result.optimisticItem)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to create folder')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleNewFolder}
      aria-label="Create new folder"
    >
      <FolderPlus className="h-4 w-4" />
    </Button>
  )
}
