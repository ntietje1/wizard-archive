import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useCampaign } from '~/contexts/CampaignContext'
import type { Id } from 'convex/_generated/dataModel'

export const useEditorNavigation = () => {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()

  const navigateToNote = useCallback(
    (slug: string | null) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          note: slug || undefined,
          // Clear other content type params
          map: undefined,
          category: undefined,
          folderId: undefined,
        },
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
          category: undefined,
          folderId: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const navigateToCategory = useCallback(
    (slug: string, folderId?: Id<'folders'>) => {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/editor',
        params: { dmUsername, campaignSlug },
        search: {
          category: slug,
          folderId: folderId ?? undefined,
          // Clear other content type params
          note: undefined,
          map: undefined,
        },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const clearEditorContent = useCallback(() => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/editor',
      params: { dmUsername, campaignSlug },
      search: {
        note: undefined,
        map: undefined,
        category: undefined,
        folderId: undefined,
      },
    })
  }, [dmUsername, campaignSlug, navigate])

  return {
    navigateToNote,
    navigateToMap,
    navigateToCategory,
    clearEditorContent,
  }
}

