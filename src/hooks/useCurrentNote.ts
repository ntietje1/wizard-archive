import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useCallback, useEffect, useMemo } from 'react'
import { useCampaign } from '~/contexts/CampaignContext'
import { useNoteActions } from './useNoteActions'
import { debounce } from 'lodash-es'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import { useAuth } from '@clerk/tanstack-react-start'

export const useCurrentNote = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const { updateNoteContent } = useNoteActions()
  const { isLoaded, isSignedIn } = useAuth()
  const campaignId = campaignWithMembership.data?.campaign._id

  const pathNoteSlug =
    location.pathname.includes('/notes/') &&
    !location.pathname.endsWith('/notes')
      ? location.pathname.split('/notes/')[1]
      : null

  const note = useQuery(
    convexQuery(
      api.notes.queries.getNoteBySlug,
      isLoaded && isSignedIn && pathNoteSlug && campaignId
        ? { campaignId, slug: pathNoteSlug }
        : 'skip',
    ),
  )

  const selectNote = useCallback(
    (noteSlug: string | null) => {
      if (!noteSlug) {
        navigate({
          to: '/campaigns/$dmUsername/$campaignSlug/notes',
          params: { dmUsername, campaignSlug },
        })
        return
      }
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/notes/$noteSlug',
        params: { dmUsername, campaignSlug, noteSlug },
      })
    },
    [dmUsername, campaignSlug, navigate],
  )

  const updateCurrentNoteContent = useMemo(
    () =>
      debounce((newContent: CustomBlock[]) => {
        if (!note.data?._id) return
        updateNoteContent(note.data._id, newContent)
      }, 800),
    [updateNoteContent, note.data?._id],
  )

  useEffect(() => {
    return () => {
      updateCurrentNoteContent.flush()
    }
  }, [pathNoteSlug, updateCurrentNoteContent])
  return {
    note,
    noteSlug: pathNoteSlug,
    selectNote,
    updateCurrentNoteContent,
  }
}
