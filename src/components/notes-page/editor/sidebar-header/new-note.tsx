import { useState } from 'react'
import { toast } from 'sonner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { Button } from '~/components/shadcn/ui/button'
import { FilePlus, Loader2 } from '~/lib/icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function NewNoteButton() {
  const { createItem } = useSidebarItemMutations()
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
      })
      openParentFolders(result.id)
      navigateToItem(result)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create note')
    } finally {
      setIsPending(false)
    }
  }

  return (
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
  )
}
