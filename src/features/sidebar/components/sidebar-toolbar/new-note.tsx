import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { FilePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { handleError, logger } from '~/shared/utils/logger'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'

export function NewNoteButton() {
  const { createItem } = useCreateFileSystemItem()
  const { getDefaultName } = useSidebarValidation()
  const { campaignId } = useCampaign()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const creationPendingRef = useRef(false)
  const [creationPending, setCreationPending] = useState(false)

  const handleNewNote = async () => {
    if (creationPendingRef.current) {
      toast.info('Note creation in progress')
      return
    }
    if (!campaignId) {
      logger.warn('Cannot create note without a campaign id')
      return
    }
    creationPendingRef.current = true
    setCreationPending(true)
    try {
      const result = await createItem({
        type: SIDEBAR_ITEM_TYPES.notes,
        parentTarget: { kind: 'direct', parentId: null },
        name: getDefaultName(SIDEBAR_ITEM_TYPES.notes, null),
      })
      openParentFolders(result.id)
      void navigateToItem(result.slug)
    } catch (error) {
      handleError(error, 'Failed to create note')
    } finally {
      creationPendingRef.current = false
      setCreationPending(false)
    }
  }

  return (
    <TooltipButton tooltip="New note" side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNewNote}
        aria-label="Create new note"
        aria-busy={creationPending}
      >
        <FilePlus className="size-4" />
      </Button>
    </TooltipButton>
  )
}
