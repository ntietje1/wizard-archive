import { useEffect } from 'react'
import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { UserPreferences } from 'convex/userPreferences/types'
import type { Theme } from '~/features/settings/hooks/useTheme'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import {
  ThemeProviderContext,
  applyThemeClass,
  resolveTheme,
} from '~/features/settings/hooks/useTheme'
import { userPreferencesQueryOptions } from '~/features/settings/hooks/useUserPreferences'

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: Theme | null
}) {
  const queryClient = useQueryClient()

  const { data: prefs } = useAuthQuery(
    api.userPreferences.queries.getUserPreferences,
    {},
    { placeholderData: keepPreviousData },
  )

  const setThemeMutation = useAppMutation(api.userPreferences.mutations.setUserPreferences, {
    onMutate: async ({ theme: newTheme }) => {
      if (!newTheme) return
      await queryClient.cancelQueries({
        queryKey: userPreferencesQueryOptions.queryKey,
      })
      const previous = queryClient.getQueryData<UserPreferences>(
        userPreferencesQueryOptions.queryKey,
      )
      queryClient.setQueryData(
        userPreferencesQueryOptions.queryKey,
        (old: UserPreferences | null | undefined) => {
          if (!old) return old
          return { ...old, theme: newTheme }
        },
      )
      applyThemeClass(resolveTheme(newTheme))
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userPreferencesQueryOptions.queryKey, context.previous)
        applyThemeClass(resolveTheme(context.previous.theme ?? 'system'))
      }
      handleError(err, 'Failed to update theme')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: userPreferencesQueryOptions.queryKey,
      })
    },
  })

  const theme: Theme = prefs?.theme ?? initialTheme ?? 'system'
  const resolved = resolveTheme(theme)

  const setTheme = (newTheme: Theme) => {
    setThemeMutation.mutate({ theme: newTheme })
  }

  useEffect(() => {
    applyThemeClass(resolved)
  }, [resolved])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      applyThemeClass(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
