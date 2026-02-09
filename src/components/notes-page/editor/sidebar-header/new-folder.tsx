import { toast } from 'sonner'
import { Button } from '~/components/shadcn/ui/button'
import { FolderPlus } from '~/lib/icons'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

export function NewFolderButton() {
  const { createFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const { navigateToFolder } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const campaignId = campaignWithMembership.data?.campaign._id

  const handleNewFolder = async () => {
    if (!campaignId) return
    try {
      const { folderId, slug } = await createFolder.mutateAsync({ campaignId })
      await openParentFolders(folderId)
      navigateToFolder(slug)
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
