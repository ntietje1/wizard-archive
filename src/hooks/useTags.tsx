import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { CATEGORY_KIND } from 'convex/tags/types'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMemo } from 'react'
import type { Tag } from 'convex/tags/types'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/hooks/useCampaign'

export function getTagColor(tag: Tag): string {
  return tag.color ?? tag.category?.defaultColor ?? '#808080'
}

export function useTags() {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const tags = useQuery(
    convexQuery(
      api.tags.queries.getTagsByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  return {
    nonSystemManagedTags:
      tags.data?.filter(
        (tag: Tag) => tag.category?.kind !== CATEGORY_KIND.SystemManaged,
      ) || [],
    tags: tags.data || [],
  }
}

interface UseBlockTagsParams {
  noteId: Id<'notes'> | undefined
  blockId: string
  searchQuery?: string
}

export function useBlockTags({
  noteId,
  blockId,
  searchQuery = '',
}: UseBlockTagsParams) {
  const { nonSystemManagedTags } = useTags()

  const blockTagState = useQuery(
    convexQuery(
      api.blocks.queries.getBlockTagState,
      noteId ? { noteId, blockId } : 'skip',
    ),
  )

  const addTagToBlock = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.addTagToBlock),
  })

  const removeTagFromBlock = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.removeTagFromBlock),
  })

  const isMutating = addTagToBlock.isPending || removeTagFromBlock.isPending

  const state = blockTagState.data
  const isBlockNotFound = state === null
  const inlineTagIds = useMemo(
    () => state?.inlineTagIds ?? [],
    [state?.inlineTagIds],
  )
  const manualTagIds = useMemo(
    () => state?.blockTagIds ?? [],
    [state?.blockTagIds],
  )
  const noteTagId = state?.noteTagId ?? null
  const allBlockTagIds = useMemo(
    () => new Set(state?.allTagIds ?? []),
    [state?.allTagIds],
  )

  // Locked tags cannot be removed (inline tags and note-level tag)
  const lockedTagIds = useMemo(
    () => new Set([...inlineTagIds, ...(noteTagId ? [noteTagId] : [])]),
    [inlineTagIds, noteTagId],
  )

  const tagMap = useMemo(
    () => new Map(nonSystemManagedTags.map((tag) => [tag._id, tag])),
    [nonSystemManagedTags],
  )

  // Unavailable tags are locked (cannot be removed)
  const unavailableTags = useMemo(
    () => nonSystemManagedTags.filter((tag) => lockedTagIds.has(tag._id)),
    [nonSystemManagedTags, lockedTagIds],
  )

  // Available tags are those not already applied to the block
  const availableTags = useMemo(
    () => nonSystemManagedTags.filter((tag) => !allBlockTagIds.has(tag._id)),
    [nonSystemManagedTags, allBlockTagIds],
  )

  // Filter available tags by search query
  const filteredAvailableTags = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return availableTags
    return availableTags.filter((tag) =>
      (tag.name || '').toLowerCase().includes(query),
    )
  }, [availableTags, searchQuery])

  // Manual tags are applied block-level tags that can be removed (excludes locked tags)
  const manualTagObjects = useMemo(
    () =>
      manualTagIds
        .filter((tagId) => !lockedTagIds.has(tagId))
        .map((tagId) => tagMap.get(tagId))
        .filter((tag): tag is Tag => tag !== undefined),
    [manualTagIds, lockedTagIds, tagMap],
  )

  const handleAddTag = async (tagId: Id<'tags'>) => {
    if (!noteId || isMutating) return
    await addTagToBlock.mutateAsync({
      noteId,
      blockId,
      tagId,
    })
  }

  const handleRemoveTag = async (tagId: Id<'tags'>) => {
    if (!noteId || isMutating) return
    await removeTagFromBlock.mutateAsync({
      noteId,
      blockId,
      tagId,
    })
  }

  return {
    unavailableTags,
    availableTags,
    filteredAvailableTags,
    manualTagObjects,
    isMutating,
    isLoading: blockTagState.isLoading,
    isBlockNotFound,
    handleAddTag,
    handleRemoveTag,
  }
}
