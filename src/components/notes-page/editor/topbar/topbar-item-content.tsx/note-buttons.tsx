import { BookOpen, Eye, Pencil } from 'lucide-react'
import { useCallback } from 'react'
import { ItemButtonWrapper } from './item-button-wrapper'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { useEditorMode } from '~/hooks/useEditorMode'
import { Button } from '~/components/shadcn/ui/button'

export const NoteButtons = () => {
  return (
    <ItemButtonWrapper>
      <ViewAsPlayerButton />
      <EditorViewModeToggleButton />
    </ItemButtonWrapper>
  )
}

export const ViewAsPlayerButton = () => {
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers = campaignMembersQuery.data || []
  const { viewAsPlayerId, setViewAsPlayerId } = useEditorMode()

  const isPending = campaignMembersQuery.isPending

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" disabled={isPending}>
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
                const displayName = profile.name || profile.username || 'Player'
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
  )
}

export const EditorViewModeToggleButton = () => {
  const { editorMode, setEditorMode } = useEditorMode()
  const handleEditorModeToggle = useCallback(() => {
    setEditorMode(editorMode === 'editor' ? 'viewer' : 'editor')
  }, [editorMode, setEditorMode])
  const label =
    editorMode === 'editor' ? 'Switch to viewer mode' : 'Switch to editor mode'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleEditorModeToggle}
      aria-label={label}
      title={label}
    >
      {editorMode === 'editor' ? (
        <Pencil className="h-4 w-4" />
      ) : (
        <BookOpen className="h-4 w-4" />
      )}
    </Button>
  )
}
