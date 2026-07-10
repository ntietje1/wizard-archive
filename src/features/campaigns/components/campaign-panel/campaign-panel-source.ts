import type { MaybePromise } from 'shared/common/async'
import type { Session } from 'shared/sessions/types'

export interface CampaignPanelSource {
  campaignName: string
  currentSession: Session | null
  isDm: boolean
  isLoadingSessions: boolean
  memberCount: number
  sessions: Array<Session>
  sessionActions: {
    endCurrentSession: () => MaybePromise<unknown>
    isEndingCurrentSession: boolean
    isSettingCurrentSession: boolean
    isStartingSession: boolean
    setCurrentSession: (sessionId: Session['id']) => MaybePromise<unknown>
    startSession: () => MaybePromise<unknown>
  }
}
