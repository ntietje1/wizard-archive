import { useCallback, useEffect } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { UserPreferences } from 'convex/userPreferences/types'
import type { Theme } from '~/hooks/useTheme'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import {
  ThemeProviderContext,
  applyThemeClass,
  resolveTheme,
} from '~/hooks/useTheme'
import { userPreferencesQueryOptions } from '~/hooks/useUserPreferences'

const FOUC_SCRIPT = `(function(){try{var t=window.__INITIAL_THEME__;var r=(t==='dark'||t==='light')?t:(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.classList.add(r)}catch(e){}})();`

const escapeScriptContent = (str: string) =>
  str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

/**
 * Blocking inline script that sets the theme class on `<html>` before paint.
 * Render this inside `<head>`.
 */
export function ThemeScript({ initialTheme }: { initialTheme?: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__INITIAL_THEME__=${escapeScriptContent(JSON.stringify(initialTheme ?? null))};${FOUC_SCRIPT}`,
      }}
    />
  )
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const queryClient = useQueryClient()

  const { data: prefs } = useAuthQuery(
    api.userPreferences.queries.getUserPreferences,
    {},
    { placeholderData: keepPreviousData },
  )

  const mutationFn = useConvexMutation(
    api.userPreferences.mutations.setUserPreferences,
  )

  const setThemeMutation = useMutation({
    mutationFn,
    onMutate: async ({ theme: newTheme }: { theme: Theme }) => {
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
    onError: (_err, _vars, context) => {
      if (context?.previous?.theme) {
        queryClient.setQueryData(
          userPreferencesQueryOptions.queryKey,
          context.previous,
        )
        applyThemeClass(resolveTheme(context.previous.theme))
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: userPreferencesQueryOptions.queryKey,
      })
    },
  })

  const theme: Theme = prefs?.theme ?? initialTheme ?? 'system'
  const resolved = resolveTheme(theme)

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeMutation.mutate({ theme: newTheme })
    },
    [setThemeMutation],
  )

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
