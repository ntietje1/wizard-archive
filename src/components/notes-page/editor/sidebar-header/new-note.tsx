import { toast } from 'sonner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { Button } from '~/components/shadcn/ui/button'
import { FilePlus } from '~/lib/icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function NewNoteButton() {
  const { createItem } = useSidebarItemMutations()
  const { campaignWithMembership } = useCampaign()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleNewNote = () => {
    if (!campaignId) return
    try {
      const result = createItem({
        type: SIDEBAR_ITEM_TYPES.notes,
        campaignId,
      })
      if (result) {
        openParentFolders(result.tempId)
        navigateToItem(result.optimisticItem)
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to create note')
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleNewNote}>
      <FilePlus className="h-4 w-4" />
    </Button>
  )
}
