import { api } from 'convex/_generated/api'
import { createYjsProviderUser } from '@wizard-archive/editor/collaboration/yjs-provider'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useLiveCollaborationUser() {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data

  return {
    isLoading: profileQuery.isLoading,
    user: createYjsProviderUser({
      userId: profile?.id,
      name: profile?.name ?? profile?.username ?? 'Anonymous',
    }),
  }
}
