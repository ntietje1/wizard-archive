import { CloseAllFoldersButton } from './close-all-folders'
import { NewFolderButton } from './new-folder'
import { NewNoteButton } from './new-note'
import { SortMenu } from './sort-menu'
import { BookmarksFilterButton } from './bookmarks-filter-button'
import { TooltipButton } from '~/components/tooltips/tooltip-button'
import { useFileSidebar } from '~/hooks/useFileSidebar'

export function SidebarHeader() {
  const { bookmarksOnlyMode } = useFileSidebar()

  return (
    <div className="flex items-center justify-center px-8 h-10 border-b bg-background">
      <TooltipButton tooltip="New note">
        <NewNoteButton />
      </TooltipButton>
      <TooltipButton tooltip="New folder">
        <NewFolderButton />
      </TooltipButton>
      <TooltipButton tooltip="Close all folders">
        <CloseAllFoldersButton />
      </TooltipButton>
      <TooltipButton tooltip="Change sort order">
        <SortMenu />
      </TooltipButton>
      <TooltipButton
        tooltip={bookmarksOnlyMode ? 'Exit bookmarks' : 'Show bookmarks'}
      >
        <BookmarksFilterButton />
      </TooltipButton>
    </div>
  )
}
