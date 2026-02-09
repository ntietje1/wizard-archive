import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'
import { File, FileText, Folder, MapPin, Plus } from '~/lib/icons'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useMapActions } from '~/hooks/useMapActions'
import { useFileActions } from '~/hooks/useFileActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

interface CreateNewButtonProps {
  icon: LucideIcon
  name: string
  description: string
  onClick: () => void
}

function CreateNewButton({
  icon: Icon,
  name,
  description,
  onClick,
}: CreateNewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 w-full px-4 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left group"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
        <Plus className="h-4 w-4" />
      </div>
    </button>
  )
}

interface CreateNewDashboardProps {
  parentId?: Id<'folders'>
  folderPath?: string
}

export function CreateNewDashboard({ parentId, folderPath }: CreateNewDashboardProps) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { createMap } = useMapActions()
  const { createFile } = useFileActions()
  const { navigateToNote, navigateToFolder, navigateToMap, navigateToFile } =
    useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()

  const handleCreateNote = async () => {
    if (!campaignId) return
    try {
      const { noteId, slug } = await createNote.mutateAsync({ campaignId, parentId })
      await openParentFolders(noteId)
      navigateToNote(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create note')
    }
  }

  const handleCreateFolder = async () => {
    if (!campaignId) return
    try {
      const { folderId, slug } = await createFolder.mutateAsync({ campaignId, parentId })
      await openParentFolders(folderId)
      navigateToFolder(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create folder')
    }
  }

  const handleCreateMap = async () => {
    if (!campaignId) return
    try {
      const { mapId, slug } = await createMap.mutateAsync({ campaignId, parentId })
      await openParentFolders(mapId)
      navigateToMap(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create map')
    }
  }

  const handleCreateFile = async () => {
    if (!campaignId) return
    try {
      const { fileId, slug } = await createFile.mutateAsync({ campaignId, parentId })
      await openParentFolders(fileId)
      navigateToFile(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create file')
    }
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Create New Section */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Create New
            </h2>
            {folderPath && (
              <p className="text-xs text-muted-foreground mt-1">{folderPath}</p>
            )}
          </div>
          <div className="space-y-2">
            <CreateNewButton
              icon={FileText}
              name="Note"
              description="Write and organize your thoughts"
              onClick={handleCreateNote}
            />
            <CreateNewButton
              icon={Folder}
              name="Folder"
              description="Group related items together"
              onClick={handleCreateFolder}
            />
            <CreateNewButton
              icon={MapPin}
              name="Map"
              description="Upload an image to pin items on"
              onClick={handleCreateMap}
            />
            <CreateNewButton
              icon={File}
              name="File"
              description="Upload a document, image, or media"
              onClick={handleCreateFile}
            />
          </div>
        </div>

        {/* Create from Template Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Create from Template
          </h2>
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Templates will appear here once created
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
