import type { CampaignPanelSource } from '~/features/campaigns/components/campaign-panel/campaign-panel-source'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLiveGameSession } from './use-live-game-session'

export function useLiveCampaignPanelSource(): CampaignPanelSource {
  const { campaign, isDm } = useCampaign()
  const { currentSession, sessions, startSession, endCurrentSession, setCurrentSession } =
    useLiveGameSession()
  const isLoadingSessions = currentSession.isPending || sessions.isPending

  return {
    campaignName: campaign.data?.name ?? 'Campaign',
    currentSession: currentSession.data ?? null,
    isDm: Boolean(isDm),
    isLoadingSessions,
    memberCount: campaign.data?.acceptedMemberCount ?? 0,
    sessions: sessions.data ?? [],
    sessionActions: {
      endCurrentSession: () => endCurrentSession.mutateAsync({}),
      isEndingCurrentSession: endCurrentSession.isPending,
      isSettingCurrentSession: setCurrentSession.isPending,
      isStartingSession: startSession.isPending,
      setCurrentSession: (sessionId) => setCurrentSession.mutateAsync({ sessionId }),
      startSession: () => startSession.mutateAsync({}),
    },
  }
}
