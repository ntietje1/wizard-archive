import { FilePlus, FolderPlus } from '~/lib/icons'
import {
  ContextMenu,
  type ContextMenuItem,
} from '~/components/context-menu/base/context-menu'
import type { Id } from 'convex/_generated/dataModel'
import { toast } from 'sonner'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { Grid2x2Plus } from 'lucide-react'

interface RootContextMenuProps {
  children: React.ReactNode
  className?: string
}

export function RootContextMenu({ children, className }: RootContextMenuProps) {
  const { createNote } = useNoteActions()
  const { createFolder } = useFolderActions()
  const { setRenamingId } = useFileSidebar()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  if (!campaignId) return children

  const handleNewNote = () => {
    createNote
      .mutateAsync({ campaignId: campaignId })
      .then(({ noteId }) => {
        setRenamingId(noteId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create note')
      })
  }

  const handleNewFolder = () => {
    createFolder
      .mutateAsync({ campaignId: campaignId })
      .then((folderId: Id<'folders'>) => {
        setRenamingId(folderId)
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to create folder')
      })
  }

  const handleNewCanvas = () => {
    toast.error('Not implemented')
  }

  const menuItems: ContextMenuItem[] = [
    {
      type: 'action',
      label: 'New Note',
      icon: <FilePlus className="h-4 w-4" />,
      onClick: handleNewNote,
    },
    {
      type: 'action',
      label: 'New Folder',
      icon: <FolderPlus className="h-4 w-4" />,
      onClick: handleNewFolder,
    },
    {
      type: 'action',
      label: 'New Canvas',
      icon: <Grid2x2Plus className="h-4 w-4" />,
      onClick: handleNewCanvas,
    },
  ]

  return (
    <ContextMenu items={menuItems} className={className}>
      {children}
    </ContextMenu>
  )
}

