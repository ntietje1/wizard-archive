import { toast } from 'sonner'
import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import {
  Check,
  File,
  FileText,
  Folder,
  Loader2,
  MapPin,
  Plus,
} from '~/lib/icons'
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
  isCreating: boolean
  isSuccess: boolean
  disabled: boolean
}

function CreateNewButton({
  icon: Icon,
  name,
  description,
  onClick,
  isCreating,
  isSuccess,
  disabled,
}: CreateNewButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 w-full px-4 py-3 h-auto justify-start text-left group bg-card hover:bg-accent/50"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors text-muted-foreground group-hover:text-foreground">
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSuccess ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </div>
    </Button>
  )
}

interface CreateNewDashboardProps {
  parentId?: Id<'folders'>
  folderPath?: string
}

export function CreateNewDashboard({
  parentId,
  folderPath,
}: CreateNewDashboardProps) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { createMap } = useMapActions()
  const { createFile } = useFileActions()
  const { navigateToNote, navigateToFolder, navigateToMap, navigateToFile } =
    useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const [isNavigating, setIsNavigating] = useState(false)

  const isAnyCreating =
    createNote.isPending ||
    createFolder.isPending ||
    createMap.isPending ||
    createFile.isPending

  const isDisabled = isAnyCreating || isNavigating

  const handleCreateNote = async () => {
    if (!campaignId || isAnyCreating) return
    try {
      const { noteId, slug } = await createNote.mutateAsync({
        campaignId,
        parentId,
      })
      setIsNavigating(true)
      await openParentFolders(noteId)
      await navigateToNote(slug)
      setIsNavigating(false)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create note')
    }
  }

  const handleCreateFolder = async () => {
    if (!campaignId || isAnyCreating) return
    try {
      const { folderId, slug } = await createFolder.mutateAsync({
        campaignId,
        parentId,
      })
      setIsNavigating(true)
      await openParentFolders(folderId)
      await navigateToFolder(slug)
      setIsNavigating(false)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create folder')
    }
  }

  const handleCreateMap = async () => {
    if (!campaignId || isAnyCreating) return
    try {
      const { mapId, slug } = await createMap.mutateAsync({
        campaignId,
        parentId,
      })
      setIsNavigating(true)
      await openParentFolders(mapId)
      await navigateToMap(slug)
      setIsNavigating(false)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create map')
    }
  }

  const handleCreateFile = async () => {
    if (!campaignId || isAnyCreating) return
    try {
      const { fileId, slug } = await createFile.mutateAsync({
        campaignId,
        parentId,
      })
      setIsNavigating(true)
      await openParentFolders(fileId)
      await navigateToFile(slug)
      setIsNavigating(false)
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
              disabled={isDisabled}
              isCreating={isDisabled && createNote.isPending}
              isSuccess={createNote.isSuccess}
            />
            <CreateNewButton
              icon={Folder}
              name="Folder"
              description="Group related items together"
              onClick={handleCreateFolder}
              disabled={isDisabled}
              isCreating={isDisabled && createFolder.isPending}
              isSuccess={createFolder.isSuccess}
            />
            <CreateNewButton
              icon={MapPin}
              name="Map"
              description="Upload an image to pin items on"
              onClick={handleCreateMap}
              disabled={isDisabled}
              isCreating={isDisabled && createMap.isPending}
              isSuccess={createMap.isSuccess}
            />
            <CreateNewButton
              icon={File}
              name="File"
              description="Upload a document, image, or media"
              onClick={handleCreateFile}
              disabled={isDisabled}
              isCreating={isDisabled && createFile.isPending}
              isSuccess={createFile.isSuccess}
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
