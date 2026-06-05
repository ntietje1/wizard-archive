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
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '~/features/sidebar/sidebar-item-creation-catalog'

const NEW_NOTE_COMMAND = SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note']
const NewNoteIcon = NEW_NOTE_COMMAND.icon
const NEW_NOTE_LABEL = NEW_NOTE_COMMAND.label
const NEW_NOTE_LABEL_LOWER = NEW_NOTE_LABEL.toLowerCase()

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
      toast.info(`${NEW_NOTE_LABEL} creation in progress`)
      return
    }
    if (!campaignId) {
      logger.warn(`Cannot create ${NEW_NOTE_LABEL_LOWER} without a campaign id`)
      return
    }
    creationPendingRef.current = true
    setCreationPending(true)
    try {
      const result = await createItem({
        type: NEW_NOTE_COMMAND.type,
        parentTarget: { kind: 'direct', parentId: null },
        name: getDefaultName(NEW_NOTE_COMMAND.type, null),
      })
      openParentFolders(result.id)
      void navigateToItem(result.slug)
    } catch (error) {
      handleError(error, NEW_NOTE_COMMAND.failureMessage)
    } finally {
      creationPendingRef.current = false
      setCreationPending(false)
    }
  }

  return (
    <TooltipButton tooltip={`New ${NEW_NOTE_LABEL_LOWER}`} side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNewNote}
        aria-label={`Create new ${NEW_NOTE_LABEL_LOWER}`}
        aria-busy={creationPending}
      >
        <NewNoteIcon className="size-4" />
      </Button>
    </TooltipButton>
  )
}
