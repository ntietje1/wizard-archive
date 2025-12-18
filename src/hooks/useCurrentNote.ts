import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { useAuth } from '@clerk/tanstack-react-start'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import { useEditorNavigation } from './useEditorNavigation'

export const useCurrentNote = () => {
  const { campaignWithMembership } = useCampaign()
  const { isLoaded, isSignedIn } = useAuth()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateToNote } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const noteSlug = search.note

  const note = useQuery(
    convexQuery(
      api.notes.queries.getNoteBySlug,
      isLoaded && isSignedIn && noteSlug && campaignId
        ? { campaignId, slug: noteSlug }
        : 'skip',
    ),
  )

  return {
    note,
    noteSlug,
    selectNote: navigateToNote,
  }
}
