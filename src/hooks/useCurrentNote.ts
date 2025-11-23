import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useEffect, useMemo } from 'react'
import { useCampaign } from '~/contexts/CampaignContext'
import { useNoteActions } from './useNoteActions'
import { debounce } from 'lodash-es'
import type { CustomBlock } from '~/lib/editor-schema'
import { useAuth } from '@clerk/tanstack-react-start'
import type { NotesSearch } from '~/routes/_authed/campaigns/$dmUsername.$campaignSlug/notes/-components/validateSearch'
import { useEditorNavigation } from './useEditorNavigation'

export const useCurrentNote = () => {
  const { campaignWithMembership } = useCampaign()
  const { updateNoteContent } = useNoteActions()
  const { isLoaded, isSignedIn } = useAuth()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateToNote } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/notes',
  }) as NotesSearch

  const noteSlug = search.note

  const note = useQuery(
    convexQuery(
      api.notes.queries.getNoteBySlug,
      isLoaded && isSignedIn && noteSlug && campaignId
        ? { campaignId, slug: noteSlug }
        : 'skip',
    ),
  )

  const selectNote = navigateToNote

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
  }, [noteSlug, updateCurrentNoteContent])
  return {
    note,
    noteSlug,
    selectNote,
    updateCurrentNoteContent,
  }
}
