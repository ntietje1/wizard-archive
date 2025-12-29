import { Button } from '~/components/shadcn/ui/button'
import { FolderDot, FolderOpenDot } from '~/lib/icons'
import { useFileSidebar } from '~/hooks/useFileSidebar'

export function CloseAllFoldersButton() {
  const { closeAllFoldersMode, toggleCloseAllFoldersMode } = useFileSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleCloseAllFoldersMode}
      data-state={closeAllFoldersMode ? 'active' : 'inactive'}
    >
      {closeAllFoldersMode ? (
        <FolderDot className="h-4 w-4" />
      ) : (
        <FolderOpenDot className="h-4 w-4" />
      )}
    </Button>
  )
}
