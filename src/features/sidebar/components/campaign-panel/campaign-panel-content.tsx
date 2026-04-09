import { useState } from 'react'
import { ArrowLeftRight, History, Play, Settings, Square, UserPlus } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { Session } from 'convex/sessions/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSession } from '~/features/sidebar/hooks/useGameSession'
import { useSettingsStore } from '~/features/settings/hooks/settings-store'

function formatSessionDate(s: Session): string {
  const date = new Date(s.startedAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function CampaignPanelContent({ onClose }: { onClose: () => void }) {
  const { campaign, campaignId, isDm } = useCampaign()
  const { currentSession, sessions, startSession, endCurrentSession, setCurrentSession } =
    useSession()
  const openSettings = useSettingsStore((s) => s.open)
  const navigate = useNavigate()
  const [showResume, setShowResume] = useState(false)

  const hasActiveSession = !!currentSession.data
  const allSessions: Array<Session> = sessions.data ?? []
  const currentId = currentSession.data?._id
  const previousSessions = allSessions.filter((s) => s._id !== currentId)
  const memberCount = campaign.data?.playerCount

  const handleStart = () => {
    if (!campaignId) return
    startSession.mutate({ campaignId })
  }

  const handleStop = () => {
    if (!campaignId) return
    endCurrentSession.mutate({ campaignId })
  }

  const handleResume = (sessionId: Session['_id']) => {
    if (!campaignId) return
    setCurrentSession.mutate({ sessionId })
    setShowResume(false)
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
          <History className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="border-t" />
        <div className="max-h-64 overflow-y-auto p-1">
          {previousSessions.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No previous sessions</div>
          )}
          {previousSessions.map((s) => (
            <button
              key={s._id}
              type="button"
              className={menuItemClass}
              onClick={() => handleResume(s._id)}
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
      {/* Header */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium truncate">{campaign.data?.name ?? 'Campaign'}</div>
        <div className="text-xs text-muted-foreground">
          Free Plan &middot; {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </div>
      </div>

      <div className="border-t" />

      {/* Current session */}
      <div className="px-3 pt-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${hasActiveSession ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          />
          <span className="text-xs text-muted-foreground">
            {currentSession.data?.name ?? 'No active session'}
          </span>
        </div>
      </div>

      {/* Menu items */}
      <div className="p-1">
        {isDm && (
          <>
            {hasActiveSession ? (
              <button
                type="button"
                className={menuItemClass}
                onClick={handleStop}
                disabled={endCurrentSession.isPending}
              >
                <Square className="h-4 w-4" />
                Stop Session
              </button>
            ) : (
              <button
                type="button"
                className={menuItemClass}
                onClick={handleStart}
                disabled={startSession.isPending}
              >
                <Play className="h-4 w-4" />
                Start Session
              </button>
            )}
            <button
              type="button"
              className={`${menuItemClass}${hasActiveSession ? ' opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !hasActiveSession && setShowResume(true)}
              disabled={hasActiveSession}
            >
              <History className="h-4 w-4" />
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
          <UserPlus className="h-4 w-4" />
          Invite Members
        </button>

        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            openSettings('campaign-general')
            onClose()
          }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>

        <div className="border-t my-1" />

        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            void navigate({ to: '/campaigns' })
            onClose()
          }}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Switch Campaign
        </button>
      </div>
    </div>
  )
}
