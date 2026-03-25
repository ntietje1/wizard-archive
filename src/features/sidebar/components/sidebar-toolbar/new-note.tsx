import { useState } from 'react'
import { toast } from 'sonner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { FilePlus, Loader2 } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'

export function NewNoteButton() {
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { campaignId } = useCampaign()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const [isPending, setIsPending] = useState(false)

  const handleNewNote = async () => {
    if (!campaignId || isPending) return
    setIsPending(true)
    try {
      const result = await createItem({
        type: SIDEBAR_ITEM_TYPES.notes,
        campaignId,
        parentId: null,
        name: getDefaultName(SIDEBAR_ITEM_TYPES.notes, null),
      })
      openParentFolders(result.id)
      navigateToItem(result)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create note')
    }
    setIsPending(false)
  }

  return (
    <TooltipButton tooltip="New note" side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNewNote}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FilePlus className="h-4 w-4" />
        )}
      </Button>
    </TooltipButton>
  )
}
