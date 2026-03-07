import { useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { UserProfile } from 'convex/users/types'
import type { Theme } from '~/hooks/useTheme'
import {
  ThemeProviderContext,
  applyThemeClass,
  profileQueryOptions,
  resolveTheme,
} from '~/hooks/useTheme'

const FOUC_SCRIPT = `(function(){try{var t=window.__INITIAL_THEME__;var r=(t==='dark'||t==='light')?t:(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.classList.add(r)}catch(e){}})();`

/**
 * Blocking inline script that sets the theme class on `<html>` before paint.
 * Render this inside `<head>`.
 */
export function ThemeScript({ initialTheme }: { initialTheme?: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__INITIAL_THEME__=${JSON.stringify(initialTheme ?? null)};${FOUC_SCRIPT}`,
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

  const { data: profile } = useQuery({
    ...profileQueryOptions,
    staleTime: Infinity,
  })

  const setThemeMutation = useMutation({
    mutationFn: useConvexMutation(api.users.mutations.setTheme),
  })

  const theme: Theme = profile?.theme ?? initialTheme ?? 'system'
  const resolved = resolveTheme(theme)

  const setTheme = useCallback(
    (newTheme: Theme) => {
      queryClient.setQueryData(
        profileQueryOptions.queryKey,
        (old: UserProfile | null | undefined) => {
          if (!old) return old
          return { ...old, theme: newTheme }
        },
      )
      applyThemeClass(resolveTheme(newTheme))
      setThemeMutation.mutate({ theme: newTheme })
    },
    [queryClient, setThemeMutation],
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
