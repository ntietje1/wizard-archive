import { toast } from 'sonner'
import { Button } from '~/components/shadcn/ui/button'
import { FilePlus } from '~/lib/icons'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileSidebar } from '~/hooks/useFileSidebar'

export function NewNoteButton() {
  const { createNote } = useNoteActions()
  const { campaignWithMembership } = useCampaign()
  const { setRenamingId } = useFileSidebar()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleNewNote = async () => {
    if (!campaignId) return
    try {
      const { noteId } = await createNote.mutateAsync({ campaignId })
      setRenamingId(noteId)
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
