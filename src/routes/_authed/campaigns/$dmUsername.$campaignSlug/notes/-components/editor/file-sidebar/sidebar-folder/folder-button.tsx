import { UNTITLED_FOLDER_NAME, type Folder } from 'convex/folders/types'
import { DraggableFolder } from './draggable-folder'
import { useFolderState } from '~/hooks/useFolderState'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { toast } from 'sonner'
import { FolderContextMenu } from '~/components/context-menu/sidebar/generic/folder-context-menu'
import { SidebarItemButtonBase } from '../sidebar-item/sidebar-item-button-base'
import { Folder as FolderIcon } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'
import type { Id } from 'convex/_generated/dataModel'
import { useFolderActions } from '~/hooks/useFolderActions'

interface FolderButtonProps {
  folder: Folder
  ancestorIds?: Array<Id<'folders'>>
}

export function FolderButton({ folder, ancestorIds = [] }: FolderButtonProps) {
  const { isExpanded, toggleExpanded } = useFolderState(folder._id)
  const { renamingId, setRenamingId } = useFileSidebar()
  const { updateFolder } = useFolderActions()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const handleFolderClick = () => {
    toast.info('Folder clicked - functionality coming soon!')
  }

  const handleFinishRename = async (name: string) => {
    try {
      await updateFolder.mutateAsync({ folderId: folder._id, name })
    } finally {
      setRenamingId(null)
    }
  }

  return (
    <FolderContextMenu ref={contextMenuRef} folder={folder}>
      <DraggableFolder folder={folder} ancestorIds={ancestorIds}>
        <SidebarItemButtonBase
          icon={FolderIcon}
          name={folder.name || ''}
          defaultName={UNTITLED_FOLDER_NAME}
          isExpanded={isExpanded}
          isSelected={false}
          isRenaming={renamingId === folder._id}
          showChevron={true}
          onSelect={handleFolderClick}
          onMoreOptions={handleMoreOptions}
          onToggleExpanded={toggleExpanded}
          onFinishRename={handleFinishRename}
        />
      </DraggableFolder>
    </FolderContextMenu>
  )
}
