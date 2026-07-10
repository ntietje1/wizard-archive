import { Eye, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { EmptyContextMenu } from '../../context-menu/components/empty'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import { TooltipButton } from '@wizard-archive/ui/components/tooltip-button'
import { ViewAsPlayerRow } from './view-as-player-row'
import type { ViewAsParticipantCapability } from '../../sharing/contracts'

const viewAsLabel = 'View as player'
const stopViewAsLabel = 'Stop viewing as player'
const loadingViewAsLabel = 'Loading players'

export const ViewAsPlayerButton = ({
  viewAsPlayer,
}: {
  viewAsPlayer: ViewAsParticipantCapability
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const availableViewAsPlayer = viewAsPlayer.status === 'available' ? viewAsPlayer : null

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen)
  }

  if (!availableViewAsPlayer) {
    return null
  }

  const triggerLabel = availableViewAsPlayer.isPending ? loadingViewAsLabel : viewAsLabel
  const TriggerIcon = availableViewAsPlayer.isPending ? LoaderCircle : Eye

  return (
    <EmptyContextMenu>
      <span className="inline-flex">
        <TooltipButton tooltip={triggerLabel} side="bottom">
          <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger
              nativeButton
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={
                    availableViewAsPlayer.selectedParticipantId
                      ? 'text-primary hover:text-primary aria-expanded:text-primary'
                      : ''
                  }
                  disabled={availableViewAsPlayer.isPending}
                  aria-busy={availableViewAsPlayer.isPending}
                  aria-label={triggerLabel}
                  title={triggerLabel}
                >
                  <TriggerIcon
                    aria-hidden="true"
                    className={availableViewAsPlayer.isPending ? 'size-4 animate-spin' : 'size-4'}
                  />
                </Button>
              }
            />
            <DropdownMenuContent className="w-max min-w-56 max-w-[min(24rem,calc(100vw-1rem))] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto z-50">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="pb-0 pt-0.5">View as player</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableViewAsPlayer.selectedParticipantId && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        availableViewAsPlayer.setSelectedParticipantId(undefined)
                        setIsOpen(false)
                      }}
                    >
                      {stopViewAsLabel}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {availableViewAsPlayer.isPending ? (
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground">Loading players&hellip;</div>
                  </div>
                ) : availableViewAsPlayer.participants.length === 0 ? (
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground">
                      No other players in this workspace.
                    </div>
                  </div>
                ) : (
                  <>
                    {availableViewAsPlayer.participants.map((member) => {
                      const isSelected = availableViewAsPlayer.selectedParticipantId === member.id

                      return (
                        <DropdownMenuCheckboxItem
                          key={member.id}
                          checked={isSelected}
                          closeOnClick={false}
                          onCheckedChange={(checked) => {
                            availableViewAsPlayer.setSelectedParticipantId(
                              checked ? member.id : undefined,
                            )
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
      </span>
    </EmptyContextMenu>
  )
}
