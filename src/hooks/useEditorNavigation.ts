import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useCampaign } from '~/contexts/CampaignContext'
import {
  isCategory,
  isFolder,
  isGameMap,
  isNote,
  isTag,
} from '~/lib/sidebar-item-utils'

export const useEditorNavigation = () => {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()

  const navigateToNote = useCallback(
    (slug: string | null, pageSlug?: string) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          note: slug || undefined,
          page: pageSlug || undefined,
          // Clear other content type params
          tag: undefined,
          map: undefined,
          category: undefined,
          folderId: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  // does NOT update the note slug, so must be used within a note and not to navigate to a page in a different note
  const navigateToPage = useCallback(
    (pageSlug: string) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: (prev) => ({
          ...prev,
          page: pageSlug,
        }),
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const navigateToMap = useCallback(
    (slug: string) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          map: slug,
          // Clear other content type params
          note: undefined,
          tag: undefined,
          category: undefined,
          folderId: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const navigateToTag = useCallback(
    (slug: string | null, pageSlug?: string) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          tag: slug || undefined,
          page: pageSlug,
          // Clear other content type params
          note: undefined,
          map: undefined,
          category: undefined,
          folderId: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const navigateToCategory = useCallback(
    (slug: string, folderId?: Id<'notes'> | Id<'folders'>) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          category: slug,
          folderId,
          // Clear other content type params
          note: undefined,
          tag: undefined,
          map: undefined,
          folder: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const navigateToFolder = useCallback(
    (slug: string) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          folder: slug,
          // Clear other content type params
          note: undefined,
          tag: undefined,
          map: undefined,
          category: undefined,
          folderId: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const navigateToItem = useCallback(
    (item: AnySidebarItem) => {
      if (isNote(item)) {
        navigateToNote(item.slug)
      } else if (isTag(item)) {
        navigateToTag(item.slug)
      } else if (isGameMap(item)) {
        navigateToMap(item.slug)
      } else if (isCategory(item)) {
        navigateToCategory(item.slug)
      } else if (isFolder(item)) {
        navigateToFolder(item.slug)
      } else {
        // @ts-ignore - exhaustive check for unknown item types
        console.error('Invalid item type:', item.type)
      }
    },
    [
      navigateToNote,
      navigateToTag,
      navigateToMap,
      navigateToCategory,
      navigateToFolder,
    ],
  )

  const navigateToItemAndPage = useCallback(
    (item: AnySidebarItem, pageSlug?: string) => {
      if (!pageSlug) {
        navigateToItem(item)
      } else if (isNote(item)) {
        navigateToNote(item.slug, pageSlug)
      } else if (isTag(item)) {
        navigateToTag(item.slug, pageSlug)
      } else {
        navigateToItem(item)
      }
    },
    [navigateToItem, navigateToNote, navigateToTag],
  )

  const clearEditorContent = useCallback(() => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/editor',
      params: { dmUsername, campaignSlug },
      search: {
        note: undefined,
        tag: undefined,
        map: undefined,
        category: undefined,
        folderId: undefined,
      },
    })
  }, [dmUsername, campaignSlug, navigate])

  return {
    navigateToNote,
    navigateToTag,
    navigateToPage,
    navigateToMap,
    navigateToCategory,
    navigateToFolder,
    navigateToItem,
    navigateToItemAndPage,
    clearEditorContent,
  }
}
