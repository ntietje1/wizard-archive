import { toast } from 'sonner'
import { Button } from '~/components/shadcn/ui/button'
import { FilePlus } from '~/lib/icons'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function NewNoteButton() {
  const { createNote } = useNoteActions()
  const { campaignWithMembership } = useCampaign()
  const { navigateToNote } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleNewNote = async () => {
    if (!campaignId) return
    try {
      const { noteId, slug } = await createNote.mutateAsync({ campaignId })
      await openParentFolders(noteId)
      navigateToNote(slug)
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
