import { api } from 'convex/_generated/api'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

export const useToggleBookmark = () => {
  return useCampaignMutation(api.bookmarks.mutations.toggleBookmark)
}
