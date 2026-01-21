import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import { useState } from 'react'
import { BlockNoteView } from '@blocknote/shadcn'
import SelectionToolbar from '../../editor/extensions/selection-toolbar/selection-toolbar'
import { WikiLinkClickHandler } from '../../editor/extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from '../../editor/extensions/md-link/md-link-click-handler'
import { SideMenuRenderer } from '../../editor/extensions/side-menu/side-menu'
import '../../editor/extensions/wiki-link/wiki-link.css'
import '../../editor/extensions/md-link/md-link.css'
import { SlashMenu } from '../../editor/extensions/slash-menu/slash-menu'
import type { EditorViewerProps } from '../sidebar-item-editor'
import type { Id } from 'convex/_generated/dataModel'
import type { Note, NoteWithContent } from 'convex/notes/types'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { useWikiLinkExtension } from '~/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/hooks/useDisableAutolink'
import { Button } from '~/components/shadcn/ui/button'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { editorSchema } from '~/lib/editor-schema'
import { isNote } from '~/lib/sidebar-item-utils'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { Eye } from '~/lib/icons'
import { useSharedNoteContent } from '~/hooks/useSharedNoteContent'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export function NoteViewer({ item: note }: EditorViewerProps<Note>) {
  const [playerId, setPlayerId] = useState<Id<'campaignMembers'> | undefined>(
    undefined,
  )
  const { sharedNoteQuery: noteQuery } = useSharedNoteContent(
    note._id,
    playerId,
  )

  if (noteQuery.isPending || !noteQuery.data) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    )
  }

  if (!isNote(note)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for note viewer.
      </div>
    )
  }

  return (
    <NoteViewerBase
      key={noteQuery.data._id + '-' + playerId}
      noteWithContent={noteQuery.data}
      playerId={playerId}
      setPlayerId={setPlayerId}
    />
  )
}

export const NoteViewerBase = ({
  noteWithContent,
  playerId,
  setPlayerId,
}: {
  noteWithContent: NoteWithContent
  playerId: Id<'campaignMembers'> | undefined
  setPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}) => {
  const initialContent =
    noteWithContent.content.length > 0 ? noteWithContent.content : undefined

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    initialContent,
  })

  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)

  return (
    <ScrollArea className="flex-1">
      <div className="absolute top-2 right-2 z-10">
        <ViewAsPlayerButton playerId={playerId} setPlayerId={setPlayerId} />
      </div>
      <BlockNoteView
        className="mx-auto w-full max-w-3xl py-4"
        key={noteWithContent._id + 'viewer'}
        editable={false}
        editor={editor}
        theme="light"
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
      >
        <WikiLinkClickHandler editor={editor} />
        <MdLinkClickHandler editor={editor} />
        <SideMenuController sideMenu={SideMenuRenderer} />
        <SelectionToolbar />
        <SlashMenu editor={editor} />
      </BlockNoteView>
    </ScrollArea>
  )
}

export function ViewAsPlayerButton({
  playerId,
  setPlayerId,
}: {
  playerId: Id<'campaignMembers'> | undefined
  setPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}) {
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers = campaignMembersQuery.data || []

  const isPending = campaignMembersQuery.isPending

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isPending}
          >
            <Eye size={18} />
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
                const isSelected = playerId === member._id

                return (
                  <DropdownMenuCheckboxItem
                    key={member._id}
                    checked={isSelected}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setPlayerId(isSelected ? undefined : member._id)
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
