import { FolderDot, FolderOpenDot } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'

export function CloseAllFoldersButton() {
  const {
    ui: { closeAllFoldersMode },
    uiCommands: { toggleCloseAllFoldersMode },
  } = useSidebarWorkspaceSource()

  return (
    <TooltipButton tooltip="Close all folders" side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCloseAllFoldersMode}
        data-state={closeAllFoldersMode ? 'active' : 'inactive'}
        aria-label={
          closeAllFoldersMode ? 'Exit close-all-folders mode' : 'Enter close-all-folders mode'
        }
      >
        {closeAllFoldersMode ? (
          <FolderDot className="h-4 w-4" />
        ) : (
          <FolderOpenDot className="h-4 w-4" />
        )}
      </Button>
    </TooltipButton>
  )
}
