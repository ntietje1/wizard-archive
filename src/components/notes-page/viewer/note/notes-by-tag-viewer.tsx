import React from 'react'
import { api } from 'convex/_generated/api'
import { BlockNoteView } from '@blocknote/shadcn'
import { BlockNoteEditor, BlockNoteSchema } from '@blocknote/core'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import type { Id } from 'convex/_generated/dataModel'
import type { Tag } from 'convex/tags/types'
import type {CustomBlockNoteEditor, CustomPartialBlock} from '~/lib/editor-schema';
import {
  
  
  customInlineContentSpecs
} from '~/lib/editor-schema'
import { useCampaign } from '~/contexts/CampaignContext'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { useTags } from '~/hooks/useTags'
import { Button } from '~/components/shadcn/ui/button'

const schema = BlockNoteSchema.create({
  inlineContentSpecs: customInlineContentSpecs,
})

export function NotesByTagViewer() {
  const { nonSystemManagedTags } = useTags()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const [selectedTagIds, setSelectedTagIds] = React.useState<Array<Id<'tags'>>>([])

  const blocks = useQuery(
    convexQuery(
      api.blocks.queries.getBlocksByTags,
      selectedTagIds.length > 0 && campaign?._id
        ? {
            campaignId: campaign._id,
            tagIds: selectedTagIds,
          }
        : 'skip',
    ),
  )

  const editor = React.useMemo<CustomBlockNoteEditor | null>(() => {
    if (!blocks.data || blocks.data.length === 0) return null
    return BlockNoteEditor.create({
      schema,
      initialContent: blocks.data.map(
        (block) => block.content,
      ) as Array<CustomPartialBlock>,
    })
  }, [blocks.data])

  if (blocks.fetchStatus === 'fetching') {
    return <NotesByTagViewerLoading />
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="mb-4 flex flex-wrap gap-2">
        {nonSystemManagedTags?.map((tag: Tag) => (
          <Button
            key={tag._id}
            variant="outline"
            className={`px-2 py-1 rounded border ${
              selectedTagIds.includes(tag._id)
                ? 'bg-blue-200 border-blue-400'
                : 'bg-gray-100 border-gray-300'
            }`}
            aria-pressed={selectedTagIds.includes(tag._id)}
            onClick={() => {
              setSelectedTagIds((ids) =>
                ids.includes(tag._id)
                  ? ids.filter((id) => id !== tag._id)
                  : [...ids, tag._id],
              )
            }}
            type="button"
          >
            {tag.name || 'Untitled'}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          {editor && (
            <BlockNoteView
              className="pt-0"
              editor={editor}
              theme="light"
              editable={false}
            />
          )}
          {!editor && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              {selectedTagIds.length === 0
                ? 'Select tags to view blocks.'
                : 'No blocks found for selected tags.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotesByTagViewerLoading() {
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
