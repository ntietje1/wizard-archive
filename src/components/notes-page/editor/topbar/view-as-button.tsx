import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { Eye } from 'lucide-react'
import { useState } from 'react'
import { EmptyContextMenu } from '~/components/context-menu/components/EmptyContextMenu'
import { Button } from '~/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { TooltipButton } from '~/components/tooltips/tooltip-button'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { useEditorModeActions, useEditorModeState } from '~/hooks/useEditorMode'
import { cn } from '~/lib/shadcn/utils'

const label = 'View as player'

export const ViewAsPlayerButton = () => {
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers =
    campaignMembersQuery.data?.filter(
      (member) => member.role === CAMPAIGN_MEMBER_ROLE.Player,
    ) ?? []
  const { viewAsPlayerId } = useEditorModeState()
  const { setViewAsPlayerId } = useEditorModeActions()
  const [isOpen, setIsOpen] = useState(false)

  const isPending = campaignMembersQuery.isPending

  return (
    <EmptyContextMenu>
      <TooltipButton tooltip={label} side="bottom">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={label}
                title={label}
                className={cn(
                  viewAsPlayerId
                    ? 'text-blue-600 hover:text-blue-700 aria-expanded:text-blue-600'
                    : '',
                )}
              >
                <Eye className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-56 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto z-[9999]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="pb-0 pt-0.5">
                View as player
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isPending ? (
                <div className="px-2 py-2">
                  <div className="text-xs text-muted-foreground">
                    Loading players...
                  </div>
                </div>
              ) : playerMembers.length === 0 ? (
                <div className="px-2 py-2">
                  <div className="text-xs text-muted-foreground">
                    No other players in this campaign.
                  </div>
                </div>
              ) : (
                <>
                  {playerMembers.map((member) => {
                    const profile = member.userProfile
                    const displayName =
                      profile.name || profile.username || 'Player'
                    const displayText = profile.name
                      ? profile.name
                      : profile.username
                        ? `@${profile.username}`
                        : 'Player'
                    const isSelected = viewAsPlayerId === member._id

                    return (
                      <DropdownMenuCheckboxItem
                        key={member._id}
                        checked={isSelected}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setViewAsPlayerId(isSelected ? undefined : member._id)
                        }}
                        className="pl-2 pr-8 py-1.5 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
                      >
                        <span className="flex min-w-0 flex-col leading-tight flex-1 pr-6">
                          <span
                            className="truncate font-medium"
                            title={displayName}
                          >
                            {displayText}
                          </span>
                          {profile.name && profile.username && (
                            <span
                              className="truncate text-xs text-muted-foreground"
                              title={`@${profile.username}`}
                            >
                              @{profile.username}
                            </span>
                          )}
                        </span>
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
