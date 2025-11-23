import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import { SortMenu } from './sort-menu'
import { NewNoteButton } from './new-note'
import { NewFolderButton } from './new-folder'
import { CloseAllFoldersButton } from './close-all-folders'

export function SidebarHeader() {
  return (
    <div className="flex items-center justify-between px-2 pl-4 h-12 border-b bg-background">
      <h2 className="text-lg font-semibold">Files</h2>
      <div className="flex items-center gap-1">
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
    </div>
  )
}
