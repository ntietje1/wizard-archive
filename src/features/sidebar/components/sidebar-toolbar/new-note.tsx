import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '~/features/sidebar/sidebar-item-creation-catalog'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'

const NEW_NOTE_COMMAND = SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note']
const NewNoteIcon = NEW_NOTE_COMMAND.icon
const NEW_NOTE_LABEL = NEW_NOTE_COMMAND.label
const NEW_NOTE_LABEL_LOWER = NEW_NOTE_LABEL.toLowerCase()

export function NewNoteButton() {
  const {
    commands: { createSidebarItem },
  } = useSidebarWorkspaceSource()
  const creationPendingRef = useRef(false)
  const [creationPending, setCreationPending] = useState(false)

  const handleNewNote = async () => {
    if (creationPendingRef.current) {
      toast.info(`${NEW_NOTE_LABEL} creation in progress`)
      return
    }
    creationPendingRef.current = true
    setCreationPending(true)
    try {
      await createSidebarItem({ type: NEW_NOTE_COMMAND.type, parentId: null })
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
