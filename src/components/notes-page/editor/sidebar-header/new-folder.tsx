import { toast } from 'sonner'
import { Button } from '~/components/shadcn/ui/button'
import { FolderPlus } from '~/lib/icons'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileSidebar } from '~/hooks/useFileSidebar'

export function NewFolderButton() {
  const { createFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const { setRenamingId } = useFileSidebar()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleNewFolder = async () => {
    if (!campaignId) return
    try {
      const result = await createFolder.mutateAsync({ campaignId })
      setRenamingId(result.folderId)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create folder')
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleNewFolder}>
      <FolderPlus className="h-4 w-4" />
    </Button>
  )
}
