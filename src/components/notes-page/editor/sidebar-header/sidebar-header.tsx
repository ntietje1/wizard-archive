import { CloseAllFoldersButton } from './close-all-folders'
import { NewCategoryButton } from './new-category'
import { NewFolderButton } from './new-folder'
import { NewNoteButton } from './new-note'
import { SortMenu } from './sort-menu'
import { TooltipButton } from '~/components/tooltips/tooltip-button'

export function SidebarHeader() {
  return (
      <div className="flex items-center justify-center px-8 h-12 border-b bg-background">
        <TooltipButton tooltip="New note">
          <NewNoteButton />
        </TooltipButton>
        <TooltipButton tooltip="New folder">
          <NewFolderButton />
        </TooltipButton>
        <TooltipButton tooltip="New category">
          <NewCategoryButton />
        </TooltipButton>
        <TooltipButton tooltip="Close all folders">
          <CloseAllFoldersButton />
        </TooltipButton>
        <TooltipButton tooltip="Change sort order">
          <SortMenu />
        </TooltipButton>
      </div>
  )
}
