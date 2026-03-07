import { useMemo } from 'react'
import { EllipsisIcon } from 'lucide-react'
import type { Session } from 'convex/sessions/types'
import { Button } from '~/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { useSession } from '~/hooks/useSession'
import { useCampaign } from '~/hooks/useCampaign'

export function SessionPanel() {
  const { campaignId } = useCampaign()

  const {
    currentSession,
    sessions,
    endCurrentSession,
    setCurrentSession,
    startSession,
  } = useSession()

  const hasActiveSession = !!currentSession.data
  const previousSessions: Array<Session> = useMemo(() => {
    const sortedSessions: Array<Session> = sessions.data ?? []
    const currentId = currentSession.data?._id
    return sortedSessions.filter((s) => s._id !== currentId)
  }, [sessions.data, currentSession.data?._id])

  const formatSessionDate = (s: Session): string => {
    const date = new Date(s.startedAt)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const handleStart = () => {
    if (!campaignId) return
    startSession.mutate({ campaignId })
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
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                Current Session
              </div>
              <div className="truncate text-sm font-medium">
                {currentSession.data?.name ?? 'None'}
              </div>
            </div>
          </div>
        </div>
        {hasActiveSession ? (
          <span // TODO: remove hard coded shadow
            className="shrink-0 h-2.5 w-2.5 pt-1 self-start rounded-full bg-primary shadow-[0_0_8px_oklch(0.57_0.16_286.05/0.7)]"
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
              disabled={startSession.isPending}
            >
              Start Session
            </Button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="lg" className="aspect-square">
                <EllipsisIcon className="size-5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="[&>svg]:hidden">
                Resume a previous session
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 max-h-64 overflow-y-auto mb-2">
                {previousSessions.length === 0 && (
                  <DropdownMenuItem disabled>No sessions</DropdownMenuItem>
                )}
                {previousSessions.map((s) => (
                  <DropdownMenuItem
                    key={s._id}
                    onClick={() => {
                      if (campaignId) {
                        setCurrentSession.mutate({
                          sessionId: s._id,
                        })
                      }
                    }}
                  >
                    <div className="flex w-full flex-col">
                      <span className="truncate text-sm font-medium">
                        {s.name || 'Unnamed Session'}
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
