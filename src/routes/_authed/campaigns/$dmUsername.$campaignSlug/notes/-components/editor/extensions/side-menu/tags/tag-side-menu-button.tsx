import { useState, useMemo } from 'react'
import { useTags } from './use-tags'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { Badge } from '~/components/shadcn/ui/badge'
import { TagIcon, PlusIcon, Lock, X } from '~/lib/icons'
import { useComponentsContext } from '@blocknote/react'
import { toast } from 'sonner'
import { Command, CommandInput } from '~/components/shadcn/ui/command'
import type { CustomBlock } from '~/lib/editor-schema'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '~/components/shadcn/ui/dropdown-menu'
import type { Tag } from 'convex/tags/types'
import { useCurrentNote } from '~/hooks/useCurrentNote'

interface TagSideMenuButtonProps {
  block: CustomBlock
  freezeMenu: () => void
  unfreezeMenu: () => void
}

export default function TagSideMenuButton({
  block,
  freezeMenu,
  unfreezeMenu,
}: TagSideMenuButtonProps) {
  const { nonSystemManagedTags } = useTags()
  const { note } = useCurrentNote()
  const addTagToBlock = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.addTagToBlock),
  })
  const removeTagFromBlock = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.removeTagFromBlock),
  })
  const isMutating = addTagToBlock.isPending || removeTagFromBlock.isPending
  const [query, setQuery] = useState('')

  const Components = useComponentsContext()!

  const blockTagState = useQuery(
    convexQuery(
      api.notes.queries.getBlockTagState,
      note.data?._id
        ? {
            noteId: note.data._id,
            blockId: block.id,
          }
        : 'skip',
    ),
  )

  const handleAddTag = async (tagId: Id<'tags'>) => {
    if (!note.data) return
    if (isMutating) return

    try {
      await addTagToBlock.mutateAsync({
        noteId: note.data._id,
        blockId: block.id,
        tagId,
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to add tag')
    }
  }

  const handleRemoveTag = async (tagId: Id<'tags'>) => {
    if (!note.data) return
    if (isMutating) return

    try {
      await removeTagFromBlock.mutateAsync({
        noteId: note.data._id,
        blockId: block.id,
        tagId,
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to remove tag')
    }
  }

  const inlineTagIds = blockTagState.data?.inlineTagIds || []
  const manualTagIds = blockTagState.data?.blockTagIds || []
  const noteTagId = blockTagState.data?.noteTagId || null
  const allBlockTagIds = blockTagState.data?.allTagIds || []

  // Tags that are unavailable (locked) include inline tags and the note level tag
  const lockedTagIds = [...inlineTagIds, ...(noteTagId ? [noteTagId] : [])]
  const unavailableTags =
    nonSystemManagedTags?.filter((tag: Tag) =>
      lockedTagIds.includes(tag._id),
    ) || []

  // Available tags are those not already applied to the block
  const availableTags =
    nonSystemManagedTags?.filter(
      (tag: Tag) => !allBlockTagIds.includes(tag._id),
    ) || []
  const filteredAvailableTags = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableTags
    return availableTags.filter((t: Tag) => t.displayName.includes(q))
  }, [availableTags, query])

  const manualTagObjects = manualTagIds
    .map((tagId: Id<'tags'>) =>
      nonSystemManagedTags?.find((t: Tag) => t._id === tagId),
    )
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <DropdownMenu
      onOpenChange={(open: boolean) => {
        if (open) {
          freezeMenu()
        } else {
          unfreezeMenu()
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Components.SideMenu.Button
          label="Add Tags"
          className="!p-0 !px-0 !h-6 !w-6"
          icon={<TagIcon size={18} />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        className="w-72 overflow-y-auto max-h-[var(--radix-dropdown-menu-content-available-height)]"
      >
        {(unavailableTags.length > 0 || manualTagObjects.length > 0) && (
          <div className="px-2 pt-1 pb-2">
            <div className="text-xs text-muted-foreground mb-1.5">
              Current tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unavailableTags.map((tag: Tag) => (
                <div key={`inline-${tag._id}`} className="group">
                  <Badge
                    variant="secondary"
                    style={{
                      // @ts-ignore - allow CSS var injection
                      '--tag-bg': `${tag.color}20`,
                      // @ts-ignore
                      '--tag-fg': `${tag.color}`,
                    }}
                    className="inline-flex items-center py-1 transition-colors bg-[var(--tag-bg)] text-[var(--tag-fg)]"
                  >
                    <Lock aria-hidden className="opacity-0" />
                    <span>{tag.displayName}</span>
                    <Lock
                      aria-hidden
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Badge>
                </div>
              ))}

              {manualTagObjects.map((tag) => (
                <button
                  key={`manual-${tag._id}`}
                  type="button"
                  aria-label={`Remove tag ${tag.displayName}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleRemoveTag(tag._id)
                  }}
                  disabled={isMutating}
                  className="group inline-block focus-visible:outline-none cursor-pointer disabled:opacity-60"
                >
                  <Badge
                    variant="secondary"
                    style={{
                      // @ts-ignore
                      '--tag-bg': `${tag.color}20`,
                      // @ts-ignore
                      '--tag-fg': `${tag.color}`,
                    }}
                    className="inline-flex items-center py-1 transition-colors bg-[var(--tag-bg)] text-[var(--tag-fg)] hover:bg-red-500 hover:text-white group-hover:bg-red-500 group-hover:text-white"
                  >
                    <X aria-hidden className="opacity-0" />
                    <span>{tag.displayName}</span>
                    <X
                      aria-hidden
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
        <Command className="rounded-md">
          <CommandInput
            autoFocus
            placeholder="Search tags..."
            className="h-6"
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const first = filteredAvailableTags[0]
                if (first) {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAddTag(first._id)
                }
              }
            }}
          />
          <div className="p-2">
            <div className="text-xs text-muted-foreground mb-1.5">Add tags</div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
              {filteredAvailableTags.map((tag: Tag) => (
                <button
                  key={`available-${tag._id}`}
                  type="button"
                  aria-label={`Add tag ${tag.displayName}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleAddTag(tag._id)
                  }}
                  disabled={isMutating}
                  className={`group inline-block focus-visible:outline-none disabled:opacity-60`}
                  style={{
                    // @ts-ignore
                    '--tag-bg': `${tag.color}20`,
                    // @ts-ignore
                    '--tag-fg': `${tag.color}`,
                  }}
                >
                  <Badge
                    variant="secondary"
                    className="inline-flex items-center py-1 transition-colors bg-[var(--tag-bg)] text-[var(--tag-fg)] hover:!bg-green-500 hover:!text-white group-hover:!bg-green-500 group-hover:!text-white"
                  >
                    <PlusIcon aria-hidden className="opacity-0" />
                    <span>{tag.displayName}</span>
                    <PlusIcon
                      aria-hidden
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Badge>
                </button>
              ))}
              {filteredAvailableTags.length === 0 && (
                <div className="text-xs text-muted-foreground px-1 py-1">
                  No tags found.
                </div>
              )}
            </div>
          </div>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
