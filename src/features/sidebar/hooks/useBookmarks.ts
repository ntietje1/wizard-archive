import { api } from 'convex/_generated/api'
import { useAppMutation } from '~/features/shared/hooks/useAppMutation'

export const useToggleBookmark = () => {
  return useAppMutation(api.bookmarks.mutations.toggleBookmark, {
    errorMessage: 'Failed to toggle bookmark',
  })
}
