import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCallback, useEffect, useMemo } from 'react'
import { useCampaign } from '~/contexts/CampaignContext'
import { useNoteActions } from './useNoteActions'
import { debounce } from 'lodash-es'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import { useAuth } from '@clerk/tanstack-react-start'

export const useCurrentNote = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const { updateNoteContent } = useNoteActions()
  const { isLoaded, isSignedIn } = useAuth()

  const pathNoteId =
    location.pathname.includes('/notes/') &&
    !location.pathname.endsWith('/notes')
      ? location.pathname.split('/notes/')[1]
      : null

  const note = useQuery(
    convexQuery(
      api.notes.queries.getNote,
      isLoaded && isSignedIn && pathNoteId
        ? { noteId: pathNoteId as Id<'notes'> }
        : 'skip',
    ),
  )

  const selectNote = useCallback(
    (noteId: Id<'notes'> | null) => {
      if (!noteId) {
        navigate({
          to: '/campaigns/$dmUsername/$campaignSlug/notes',
          params: { dmUsername, campaignSlug },
        })
        return
      }
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/notes/$noteId',
        params: { dmUsername, campaignSlug, noteId },
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
  }, [pathNoteId, updateCurrentNoteContent])
  return {
    note,
    noteId: pathNoteId,
    selectNote,
    updateCurrentNoteContent,
  }
}
