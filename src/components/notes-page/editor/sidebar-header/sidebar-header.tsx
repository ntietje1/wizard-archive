import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import { SortMenu } from './sort-menu'
import { NewNoteButton } from './new-note'
import { NewFolderButton } from './new-folder'
import { NewCategoryButton } from './new-category'
import { CloseAllFoldersButton } from './close-all-folders'

export function SidebarHeader() {
  return (
    <div className="flex items-center justify-center px-8 h-12 border-b bg-background">
      <Tooltip>
        <TooltipTrigger asChild>
          <NewNoteButton />
        </TooltipTrigger>
        <TooltipContent>New note</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <NewFolderButton />
        </TooltipTrigger>
        <TooltipContent>New folder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <NewCategoryButton />
        </TooltipTrigger>
        <TooltipContent>New category</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <CloseAllFoldersButton />
        </TooltipTrigger>
        <TooltipContent>Close all folders</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <SortMenu />
        </TooltipTrigger>
        <TooltipContent>Change sort order</TooltipContent>
      </Tooltip>
    </div>
  )
}
