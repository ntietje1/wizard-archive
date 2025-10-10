import { useMemo } from 'react'
import { useCampaign } from '~/contexts/CampaignContext'
import { useSession } from '~/hooks/useSession'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { Button } from '~/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { EllipsisIcon } from 'lucide-react'
import type { Session } from 'convex/sessions/types'
import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'

export function SessionPanel() {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const campaignId = campaign?._id

  const {
    currentSession,
    sessions,
    endCurrentSession,
    setCurrentSession,
    startNewSession,
  } = useSession()

  const category = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaignId
        ? {
            campaignId,
            slug: SYSTEM_DEFAULT_CATEGORIES.Session.slug,
          }
        : 'skip',
    ),
  )

  const hasActiveSession = !!currentSession.data
  const sortedSessions = sessions.data ?? []
  const previousSessions = useMemo(() => {
    if (!sortedSessions) return []
    const currentId = currentSession.data?.sessionId
    return sortedSessions.filter((s) => s.sessionId !== currentId)
  }, [sortedSessions, currentSession.data?.sessionId])

  const formatSessionDate = (s: Session): string => {
    if (!s) return ''
    const date = s.description
      ? new Date(s.description)
      : new Date(s._creationTime)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const handleStart = () => {
    if (!campaignId || !category.data) return
    const now = new Date()
    startNewSession({
      categoryId: category.data._id,
      color: '#6366F1',
      description: now.toISOString(),
    })
  }

  const handleStop = () => {
    if (!campaignId) return
    endCurrentSession.mutate({ campaignId })
  }

  return (
    <div className="flex h-auto w-full flex-col gap-3 p-3 overflow-visible">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Campaign</div>
              <div className="truncate text-sm font-medium">
                {campaign?.name ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                Current Session
              </div>
              <div className="truncate text-sm font-medium">
                {currentSession.data?.displayName ?? 'None'}
              </div>
            </div>
          </div>
        </div>
        {hasActiveSession ? (
          <span
            className="shrink-0 h-2.5 w-2.5 pt-1 self-start rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]"
            aria-label="Session live"
          />
        ) : (
          <span
            className="shrink-0 h-2.5 w-2.5 pt-1 self-start rounded-full bg-muted-foreground/30"
            aria-label="No live session"
          />
        )}
      </div>

      {/* Footer Start/Stop + context menu */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <div className="flex-1">
          {hasActiveSession ? (
            <Button
              size="lg"
              variant="destructive"
              className="w-full"
              onClick={handleStop}
              disabled={endCurrentSession.isPending}
            >
              Stop Session
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={handleStart}
              disabled={!category.data}
            >
              Start Session
            </Button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg" className="aspect-square">
              <EllipsisIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="[&>svg]:hidden">
                Add to previous session
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 max-h-64 overflow-y-auto mb-2">
                {previousSessions.length === 0 && (
                  <DropdownMenuItem disabled>No sessions</DropdownMenuItem>
                )}
                {previousSessions.map((s) => (
                  <DropdownMenuItem
                    key={s.sessionId}
                    onClick={() => {
                      // setSelectedSessionId(s.sessionId)
                      if (campaignId) {
                        setCurrentSession.mutate({
                          campaignId,
                          sessionId: s.sessionId,
                        })
                      }
                    }}
                  >
                    <div className="flex w-full flex-col">
                      <span className="truncate text-sm font-medium">
                        {s.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatSessionDate(s)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
