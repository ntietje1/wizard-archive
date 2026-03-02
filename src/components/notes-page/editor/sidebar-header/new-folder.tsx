import { useState } from 'react'
import { toast } from 'sonner'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { Button } from '~/components/shadcn/ui/button'
import { FolderPlus, Loader2 } from '~/lib/icons'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function NewFolderButton() {
  const { createItem, getDefaultName } = useSidebarItemMutations()
  const { campaignId } = useCampaign()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const [isPending, setIsPending] = useState(false)

  const handleNewFolder = async () => {
    if (!campaignId || isPending) return
    setIsPending(true)
    try {
      const result = await createItem({
        type: SIDEBAR_ITEM_TYPES.folders,
        campaignId,
        parentId: null,
        name: getDefaultName(SIDEBAR_ITEM_TYPES.folders, null),
      })
      openParentFolders(result.id)
      navigateToItem(result)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create folder')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleNewFolder}
      disabled={isPending}
      aria-label="Create new folder"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FolderPlus className="h-4 w-4" />
      )}
    </Button>
  )
}
