import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { File, FilePlus, FolderPlus, MapPin, Plus } from '~/lib/icons'
import { Card } from '~/components/shadcn/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '~/components/shadcn/ui/context-menu'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useMapActions } from '~/hooks/useMapActions'
import { useFileActions } from '~/hooks/useFileActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'

interface NewItemCardProps {
  parentId: Id<'folders'>
}

export function NewItemCard({ parentId }: NewItemCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { createMap } = useMapActions()
  const { createFile } = useFileActions()
  const { navigateToNote, navigateToFolder, navigateToMap, navigateToFile } =
    useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()

  const openMenuAt = useCallback((clientX: number, clientY: number) => {
    if (triggerRef.current) {
      triggerRef.current.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: 2,
        }),
      )
      setIsOpen(true)
    }
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      openMenuAt(e.clientX, e.clientY)
    },
    [openMenuAt],
  )

  const handleCreateNote = useCallback(async () => {
    if (!campaignId) return
    try {
      const { noteId, slug } = await createNote.mutateAsync({
        campaignId,
        parentId,
      })
      await openParentFolders(noteId)
      navigateToNote(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create note')
    }
  }, [campaignId, parentId, createNote, openParentFolders, navigateToNote])

  const handleCreateFolder = useCallback(async () => {
    if (!campaignId) return
    try {
      const { folderId, slug } = await createFolder.mutateAsync({
        campaignId,
        parentId,
      })
      await openParentFolders(folderId)
      navigateToFolder(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create folder')
    }
  }, [campaignId, parentId, createFolder, openParentFolders, navigateToFolder])

  const handleCreateMap = useCallback(async () => {
    if (!campaignId) return
    try {
      const { mapId, slug } = await createMap.mutateAsync({
        campaignId,
        parentId,
      })
      await openParentFolders(mapId)
      navigateToMap(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create map')
    }
  }, [campaignId, parentId, createMap, openParentFolders, navigateToMap])

  const handleCreateFile = useCallback(async () => {
    if (!campaignId) return
    try {
      const { fileId, slug } = await createFile.mutateAsync({
        campaignId,
        parentId,
      })
      await openParentFolders(fileId)
      navigateToFile(slug)
    } catch (error) {
      console.error(error)
      toast.error('Failed to create file')
    }
  }, [campaignId, parentId, createFile, openParentFolders, navigateToFile])

  return (
    <ContextMenu open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenuTrigger
        render={
          <div ref={triggerRef} className="h-[140px]">
            <Card
              className="w-full h-full cursor-pointer rounded-md border-dashed flex items-center justify-center hover:bg-accent/50 hover:border-solid transition-all"
              onClick={handleClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  openMenuAt(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  )
                }
              }}
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
            </Card>
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={handleCreateNote}>
          <FilePlus className="h-4 w-4 mr-2" />
          New Note
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCreateFolder}>
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCreateMap}>
          <MapPin className="h-4 w-4 mr-2" />
          New Map
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCreateFile}>
          <File className="h-4 w-4 mr-2" />
          New File
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
