import { useState } from 'react'
import { useBlockTags, getTagColor } from '~/hooks/useTags'
import { Badge } from '~/components/shadcn/ui/badge'
import { TagIcon, PlusIcon, Lock, X } from '~/lib/icons'
import { useComponentsContext } from '@blocknote/react'
import { toast } from 'sonner'
import { Command, CommandInput } from '~/components/shadcn/ui/command'
import type { CustomBlock } from '~/lib/editor-schema'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '~/components/shadcn/ui/dropdown-menu'
import type { Tag } from 'convex/tags/types'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { usePageLayout } from '~/hooks/usePageLayout'
import { useCampaign } from '~/contexts/CampaignContext'
import { isNote } from '~/lib/sidebar-item-utils'

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
  const { item } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const isPageLayout = item?.type === 'notes' || item?.type === 'tags'
  const { currentPage } = usePageLayout({
    itemId: isPageLayout ? item?._id : undefined,
    itemSlug: isPageLayout ? item?.slug : undefined,
    campaignId: isPageLayout ? campaignId : undefined,
  })
  const [query, setQuery] = useState('')

  const Components = useComponentsContext()!

  const {
    unavailableTags,
    filteredAvailableTags,
    manualTagObjects,
    isMutating,
    isBlockNotFound,
    handleAddTag,
    handleRemoveTag,
  } = useBlockTags({
    noteId: isNote(currentPage) ? currentPage._id : undefined,
    blockId: block.id,
    searchQuery: query,
  })

  if (!isPageLayout) {
    return null
  }

  const handleAddTagWithToast = async (tagId: Tag['_id']) => {
    try {
      await handleAddTag(tagId)
    } catch {
      toast.error('Failed to add tag')
    }
  }

  const handleRemoveTagWithToast = async (tagId: Tag['_id']) => {
    try {
      await handleRemoveTag(tagId)
    } catch {
      toast.error('Failed to remove tag')
    }
  }

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
        {isBlockNotFound ? (
          <div className="px-2 pt-2 pb-2">
            <div className="text-xs text-muted-foreground">
              Tags are not available for empty notes. Add content to access
              tagging.
            </div>
          </div>
        ) : (
          <>
            {(unavailableTags.length > 0 || manualTagObjects.length > 0) && (
              <div className="px-2 pt-1 pb-2">
                <div className="text-xs text-muted-foreground mb-1.5">
                  Current tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unavailableTags.map((tag: Tag) => {
                    const tagColor = getTagColor(tag)
                    return (
                      <div key={`inline-${tag._id}`} className="group">
                        <Badge
                          variant="secondary"
                          style={{
                            // @ts-ignore - allow CSS var injection
                            '--tag-bg': `${tagColor}20`,
                            // @ts-ignore
                            '--tag-fg': `${tagColor}`,
                          }}
                          className="inline-flex items-center py-1 transition-colors bg-[var(--tag-bg)] text-[var(--tag-fg)]"
                        >
                          <Lock aria-hidden className="opacity-0" />
                          <span>{tag.name || ''}</span>
                          <Lock
                            aria-hidden
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </Badge>
                      </div>
                    )
                  })}

                  {manualTagObjects.map((tag: Tag) => {
                    const tagColor = getTagColor(tag)
                    return (
                      <button
                        key={`manual-${tag._id}`}
                        type="button"
                        aria-label={`Remove tag ${tag.name || ''}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveTagWithToast(tag._id)
                        }}
                        disabled={isMutating}
                        className="group inline-block focus-visible:outline-none cursor-pointer disabled:opacity-60"
                      >
                        <Badge
                          variant="secondary"
                          style={{
                            // @ts-ignore
                            '--tag-bg': `${tagColor}20`,
                            // @ts-ignore
                            '--tag-fg': `${tagColor}`,
                          }}
                          className="inline-flex items-center py-1 transition-colors bg-[var(--tag-bg)] text-[var(--tag-fg)] hover:bg-red-500 hover:text-white group-hover:bg-red-500 group-hover:text-white"
                        >
                          <X aria-hidden className="opacity-0" />
                          <span>{tag.name || ''}</span>
                          <X
                            aria-hidden
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </Badge>
                      </button>
                    )
                  })}
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
                      handleAddTagWithToast(first._id)
                    }
                  }
                }}
              />
              <div className="p-2">
                <div className="text-xs text-muted-foreground mb-1.5">
                  Add tags
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
                  {filteredAvailableTags.map((tag: Tag) => {
                    const tagColor = getTagColor(tag)
                    return (
                      <button
                        key={`available-${tag._id}`}
                        type="button"
                        aria-label={`Add tag ${tag.name || ''}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleAddTagWithToast(tag._id)
                        }}
                        disabled={isMutating}
                        className={`group inline-block focus-visible:outline-none disabled:opacity-60`}
                        style={{
                          // @ts-ignore
                          '--tag-bg': `${tagColor}20`,
                          // @ts-ignore
                          '--tag-fg': `${tagColor}`,
                        }}
                      >
                        <Badge
                          variant="secondary"
                          className="inline-flex items-center py-1 transition-colors bg-[var(--tag-bg)] text-[var(--tag-fg)] hover:!bg-green-500 hover:!text-white group-hover:!bg-green-500 group-hover:!text-white"
                        >
                          <PlusIcon aria-hidden className="opacity-0" />
                          <span>{tag.name || ''}</span>
                          <PlusIcon
                            aria-hidden
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </Badge>
                      </button>
                    )
                  })}
                  {filteredAvailableTags.length === 0 && (
                    <div className="text-xs text-muted-foreground px-1 py-1">
                      No tags found.
                    </div>
                  )}
                </div>
              </div>
            </Command>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
