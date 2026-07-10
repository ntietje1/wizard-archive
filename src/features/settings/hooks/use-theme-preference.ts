import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { UserPreferences } from 'shared/user-preferences/types'
import { userPreferencesQueryOptions } from '~/features/settings/hooks/user-preferences-query'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { handleError } from '~/shared/utils/logger'
import { applyThemeClass, resolveTheme } from '~/shared/theme/dom'

export function useThemePreference() {
  const queryClient = useQueryClient()
  const preferences = useAuthQuery(
    api.userPreferences.queries.getUserPreferences,
    {},
    {
      placeholderData: keepPreviousData,
    },
  )
  const setTheme = useAppMutation(api.userPreferences.mutations.setUserPreferences, {
    onMutate: async ({ theme }) => {
      if (!theme) return
      await queryClient.cancelQueries({ queryKey: userPreferencesQueryOptions.queryKey })
      const previous = queryClient.getQueryData<UserPreferences>(
        userPreferencesQueryOptions.queryKey,
      )
      const previousResolvedTheme: 'dark' | 'light' = document.documentElement.classList.contains(
        'light',
      )
        ? 'light'
        : 'dark'
      queryClient.setQueryData(
        userPreferencesQueryOptions.queryKey,
        (current: UserPreferences | null | undefined) =>
          current ? { ...current, theme } : current,
      )
      applyThemeClass(resolveTheme(theme))
      return { previous, previousResolvedTheme }
    },
    onError: (error, _variables, context) => {
      if (context && context.previous !== undefined) {
        queryClient.setQueryData(userPreferencesQueryOptions.queryKey, context.previous)
      }
      if (context) applyThemeClass(context.previousResolvedTheme)
      handleError(error, 'Failed to update theme')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userPreferencesQueryOptions.queryKey })
    },
  })

  return { preferences, setThemeMutation: setTheme }
}
