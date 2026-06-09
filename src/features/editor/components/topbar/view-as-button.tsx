import { Eye } from 'lucide-react'
import { useState } from 'react'
import { EmptyContextMenu } from '~/features/context-menu/components/empty-context-menu'
import { Button } from '~/features/shadcn/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/features/shadcn/components/dropdown-menu'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { ViewAsPlayerRow } from '../view-as-player-row'
import type { EditorWorkspaceViewAsPlayerChrome } from '../../workspace/editor-workspace-chrome'

const label = 'View as player'

export const ViewAsPlayerButton = ({
  viewAsPlayer,
}: {
  viewAsPlayer: EditorWorkspaceViewAsPlayerChrome
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && viewAsPlayer.selectedPlayerId) {
      setIsOpen(false)
      return
    }

    setIsOpen(nextOpen)
  }

  if (!viewAsPlayer.visible) {
    return null
  }

  return (
    <EmptyContextMenu>
      <TooltipButton tooltip={label} side="bottom">
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger
            nativeButton
            render={
              <Button
                variant="ghost"
                size="icon"
                className={
                  viewAsPlayer.selectedPlayerId
                    ? 'text-primary hover:text-primary aria-expanded:text-primary'
                    : ''
                }
                disabled={viewAsPlayer.isPending}
                aria-label={label}
                title={label}
                onClick={(event) => {
                  if (!viewAsPlayer.selectedPlayerId) return
                  event.preventDefault()
                  event.stopPropagation()
                  viewAsPlayer.setSelectedPlayerId(undefined)
                  setIsOpen(false)
                }}
              >
                <Eye className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-max min-w-56 max-w-[min(24rem,calc(100vw-1rem))] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto z-[9999]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="pb-0 pt-0.5">View as player</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {viewAsPlayer.isPending ? (
                <div className="p-2">
                  <div className="text-xs text-muted-foreground">Loading players&hellip;</div>
                </div>
              ) : viewAsPlayer.playerMembers.length === 0 ? (
                <div className="p-2">
                  <div className="text-xs text-muted-foreground">
                    No other players in this campaign.
                  </div>
                </div>
              ) : (
                <>
                  {viewAsPlayer.playerMembers.map((member) => {
                    const isSelected = viewAsPlayer.selectedPlayerId === member._id

                    return (
                      <DropdownMenuCheckboxItem
                        key={member._id}
                        checked={isSelected}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          viewAsPlayer.setSelectedPlayerId(isSelected ? undefined : member._id)
                        }}
                        className="pl-2 pr-8 py-1.5 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
                      >
                        <ViewAsPlayerRow member={member} />
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                </>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipButton>
    </EmptyContextMenu>
  )
}
