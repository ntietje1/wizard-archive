import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { PanelPreference } from 'shared/user-preferences/types'
import type { Theme } from '@wizard-archive/ui/theme/types'
import { prefetchUserPreferences } from '~/features/settings/hooks/user-preferences-query'
import { getToken } from '~/features/auth/utils/auth-server'
import { logger } from '~/shared/utils/logger'
import { AppLayout } from './-app-layout'

const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const Route = createFileRoute('/_app')({
  beforeLoad: async (ctx) => {
    if (typeof window !== 'undefined') {
      return {
        token: undefined,
        initialTheme: null,
        initialPanelPreferences: null as Record<string, PanelPreference> | null,
      }
    }

    let token: string | undefined = undefined
    try {
      token = await fetchAuthToken()
    } catch (error) {
      logger.debug('[auth] fetchAuthToken failed, falling back to client-side auth:', error)
    }
    let initialTheme: Theme | null = null
    let initialPanelPreferences: Record<string, PanelPreference> | null = null
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
      try {
        const prefs = await prefetchUserPreferences(ctx.context.queryClient)
        initialTheme = prefs?.theme ?? null
        initialPanelPreferences = prefs?.panelPreferences ?? null
      } catch (error) {
        logger.debug(
          '[preferences] prefetchUserPreferences failed, falling back to defaults:',
          error,
        )
      }
    }
    return {
      token,
      initialTheme,
      initialPanelPreferences,
    }
  },
  component: AppLayout,
})
