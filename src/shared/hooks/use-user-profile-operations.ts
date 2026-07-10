import { api } from 'convex/_generated/api'
import type { Username } from 'shared/users/validation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useUserProfileQuery() {
  return useAuthQuery(api.users.queries.getUserProfile, {})
}

export function useUsernameExistsQuery(username: Username | null) {
  return useAuthQuery(api.users.queries.checkUsernameExists, username ? { username } : 'skip')
}

export function useUpdateProfileImageMutation() {
  return useAppMutation(api.users.mutations.updateProfileImage)
}

export function useUpdateNameMutation() {
  return useAppMutation(api.users.mutations.updateName)
}

export function useUpdateUsernameMutation() {
  return useAppMutation(api.users.mutations.updateUsername)
}
