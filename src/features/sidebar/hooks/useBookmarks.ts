import { api } from 'convex/_generated/api'
import { useAppMutation } from '~/shared/hooks/useAppMutation'

export const useToggleBookmark = () => {
  return useAppMutation(api.bookmarks.mutations.toggleBookmark)
}
