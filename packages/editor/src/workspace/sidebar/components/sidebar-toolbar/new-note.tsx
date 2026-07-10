import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CREATE_NOTE_OPTION } from '../../../../filesystem/create-item-options'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { TooltipButton } from '@wizard-archive/ui/components/tooltip-button'
import type { CreateItemSource } from '../../../../filesystem/create-item-source'

const NewNoteIcon = CREATE_NOTE_OPTION.icon
const NEW_NOTE_LABEL = CREATE_NOTE_OPTION.label
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
        type: CREATE_NOTE_OPTION.type,
        parentId: null,
      })
      if (created.status === 'completed') await source.openItem(created.id)
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
