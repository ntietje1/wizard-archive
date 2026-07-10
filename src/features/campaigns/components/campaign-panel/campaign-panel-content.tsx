import { useState } from 'react'
import { ArrowLeftRight, History, Play, Square, UserPlus } from 'lucide-react'
import type { Session } from 'shared/sessions/types'
import { useSettingsStore } from '~/features/settings/hooks/settings-store'
import { handleError } from '~/shared/utils/logger'
import type { CampaignPanelSource } from './campaign-panel-source'
import { getSessionStatusDotColor } from './session-status-dot'

function formatSessionDate(s: Session): string {
  const date = new Date(s.startedAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function CampaignPanelContent({
  onClose,
  onSwitchCampaign,
  source,
}: {
  onClose: () => void
  onSwitchCampaign: () => void
  source: CampaignPanelSource
}) {
  const openSettings = useSettingsStore((s) => s.open)
  const [showResume, setShowResume] = useState(false)

  const isLoadingSessions = source.isLoadingSessions
  const hasActiveSession = !!source.currentSession
  const allSessions: Array<Session> = source.sessions
  const currentId = source.currentSession?.id
  const previousSessions = allSessions.filter((s) => s.id !== currentId)
  const memberCount = source.memberCount

  const handleStart = () => {
    runSessionAction(source.sessionActions.startSession, 'Failed to start session')
  }

  const handleStop = () => {
    runSessionAction(source.sessionActions.endCurrentSession, 'Failed to stop session')
  }

  const handleResume = (sessionId: Session['id']) => {
    runSessionAction(
      () => source.sessionActions.setCurrentSession(sessionId),
      'Failed to resume session',
      () => setShowResume(false),
    )
  }

  const menuItemClass =
    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/70'

  if (showResume) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={() => setShowResume(false)}
        >
          <History className="size-3.5" />
          Back
        </button>
        <div className="border-t" />
        <div className="max-h-64 overflow-y-auto p-1">
          {previousSessions.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No previous sessions</div>
          )}
          {previousSessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={menuItemClass}
              disabled={source.sessionActions.isSettingCurrentSession}
              onClick={() => handleResume(s.id)}
            >
              <div className="flex flex-col">
                <span className="truncate font-medium">{s.name || 'Unnamed Session'}</span>
                <span className="text-xs text-muted-foreground">{formatSessionDate(s)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2">
        <div className="text-sm font-medium truncate">{source.campaignName}</div>
        <div className="text-xs text-muted-foreground">
          Free Plan &middot; {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </div>
      </div>

      <div className="border-t" />

      <div className="px-3 pt-2">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${getSessionStatusDotColor({
              hasActiveSession,
              isLoadingSessions,
            })}`}
          />
          <span className="text-xs text-muted-foreground">
            {isLoadingSessions
              ? 'Loading sessions'
              : (source.currentSession?.name ?? 'No active session')}
          </span>
        </div>
      </div>

      <div className="p-1">
        {source.isDm && !isLoadingSessions && (
          <>
            {hasActiveSession ? (
              <button
                type="button"
                className={menuItemClass}
                onClick={handleStop}
                disabled={source.sessionActions.isEndingCurrentSession}
              >
                <Square className="size-4" />
                Stop Session
              </button>
            ) : (
              <button
                type="button"
                className={menuItemClass}
                onClick={handleStart}
                disabled={source.sessionActions.isStartingSession}
              >
                <Play className="size-4" />
                Start Session
              </button>
            )}
            <button
              type="button"
              className={`${menuItemClass}${hasActiveSession ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !hasActiveSession && setShowResume(true)}
              disabled={hasActiveSession}
            >
              <History className="size-4" />
              Resume Session
            </button>
          </>
        )}

        <div className="border-t my-1" />

        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            openSettings('campaign-people')
            onClose()
          }}
        >
          <UserPlus className="size-4" />
          Invite Members
        </button>

        <div className="border-t my-1" />

        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            onSwitchCampaign()
            onClose()
          }}
        >
          <ArrowLeftRight className="size-4" />
          Switch Campaign
        </button>
      </div>
    </div>
  )
}

function runSessionAction(
  action: () => unknown,
  errorMessage: string,
  onSuccess?: () => void,
): void {
  void Promise.resolve()
    .then(action)
    .then(() => {
      onSuccess?.()
    })
    .catch((error: unknown) => {
      handleError(error, errorMessage)
    })
}
