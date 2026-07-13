import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { SIDEBAR_ITEM_CREATION_COMMAND_BY_ID } from '../../creation-catalog'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { TooltipButton } from '@wizard-archive/ui/components/tooltip-button'
import type { CreateItemSource } from '../../../../filesystem/create-item-source'

const CREATE_NOTE_COMMAND = SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note']
const NewNoteIcon = CREATE_NOTE_COMMAND.icon
const NEW_NOTE_LABEL = CREATE_NOTE_COMMAND.label
const NEW_NOTE_LABEL_LOWER = NEW_NOTE_LABEL.toLowerCase()

export function NewNoteButton({ source }: { source: CreateItemSource }) {
  const creationPendingRef = useRef(false)
  const [creationPending, setCreationPending] = useState(false)

  if (!source.canCreateItems()) return null

  const handleNewNote = async () => {
    if (creationPendingRef.current) {
      toast.info(`${NEW_NOTE_LABEL} creation in progress`)
      return
    }
    creationPendingRef.current = true
    setCreationPending(true)
    try {
      const created = await source.createItem({
        type: CREATE_NOTE_COMMAND.type,
        parentId: null,
      })
      if (created.status === 'completed') {
        await source.openItem(created.id)
      } else {
        toast.error(`Unable to create ${NEW_NOTE_LABEL_LOWER}`)
      }
    } catch {
      toast.error(`Unable to create or open ${NEW_NOTE_LABEL_LOWER}`)
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
        disabled={creationPending}
      >
        <NewNoteIcon className="size-4" />
      </Button>
    </TooltipButton>
  )
}
