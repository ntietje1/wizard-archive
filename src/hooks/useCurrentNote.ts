import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useAuth } from '@clerk/tanstack-react-start'
import { useEditorNavigation } from './useEditorNavigation'
import type { EditorSearch } from '~/components/notes-page/validate-search'
import { useCampaign } from '~/contexts/CampaignContext'

export const useCurrentNote = () => {
  const { campaignWithMembership } = useCampaign()
  const { isLoaded, isSignedIn } = useAuth()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateToNote } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  })

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
