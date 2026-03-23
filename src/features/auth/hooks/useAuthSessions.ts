import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { ParsedUA } from '~/features/auth/utils/parse-user-agent'
import { authClient } from '~/features/auth/utils/auth-client'
import { parseUserAgent } from '~/features/auth/utils/parse-user-agent'
import { fetchDeviceSessions } from '~/features/auth/utils/device-sessions'

export type EnrichedSession = ParsedUA & {
  id: string
  token: string
  ipAddress: string | null
  lastActive: string
  isCurrent: boolean
}

const ACTIVE_SESSIONS_KEY = ['auth', 'activeSessions'] as const
const DEVICE_SESSIONS_KEY = ['auth', 'deviceSessions'] as const

export function useActiveSessions() {
  const { data: sessionData } = authClient.useSession()
  const queryClient = useQueryClient()
  const currentToken = sessionData?.session?.token

  const query = useQuery({
    queryKey: [...ACTIVE_SESSIONS_KEY, currentToken],
    queryFn: async (): Promise<Array<EnrichedSession>> => {
      const { data, error } = await authClient.listSessions()
      if (error || !data) throw new Error('Failed to load sessions')
      return data.map((s) => {
        const parsed = parseUserAgent(s.userAgent)
        const isCurrent = s.token === currentToken
        return {
          id: s.id,
          token: s.token,
          ipAddress: s.ipAddress ?? null,
          lastActive: isCurrent
            ? 'Now'
            : formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true }),
          isCurrent,
          ...parsed,
        }
      })
    },
    enabled: !!currentToken,
    meta: { errorToast: 'Failed to load sessions' },
  })

  const revokeMutation = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token })
      if (error) throw new Error('Failed to revoke session')
    },
    onSuccess: () => {
      toast.success('Session revoked')
      queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY })
    },
    onError: () => toast.error('Failed to revoke session'),
  })

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions()
      if (error) throw new Error('Failed to revoke sessions')
    },
    onSuccess: () => {
      toast.success('All other sessions revoked')
      queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY })
    },
    onError: () => toast.error('Failed to revoke sessions'),
  })

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    revokeSession: revokeMutation.mutateAsync,
    revokeOtherSessions: revokeOthersMutation.mutateAsync,
  }
}

export function useDeviceSessions() {
  const { data: currentSession } = authClient.useSession()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: DEVICE_SESSIONS_KEY,
    queryFn: fetchDeviceSessions,
    staleTime: 30_000,
    meta: { errorToast: 'Failed to load device sessions' },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: DEVICE_SESSIONS_KEY })
  }

  return {
    allSessions: query.data ?? [],
    isLoaded: query.isFetched,
    refresh,
    currentToken: currentSession?.session?.token,
  }
}
