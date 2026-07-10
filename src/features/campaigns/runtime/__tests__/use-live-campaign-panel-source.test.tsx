import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useLiveCampaignPanelSource } from '../use-live-campaign-panel-source'
import type { SessionId } from 'shared/common/ids'

const campaignMocks = vi.hoisted(() => ({
  useCampaign: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  endCurrentSessionMutate: vi.fn(),
  endCurrentSessionMutateAsync: vi.fn(),
  sessionQueryState: {
    currentSession: { data: null, isPending: false },
    sessions: { data: [], isPending: false },
  },
  setCurrentSessionMutate: vi.fn(),
  setCurrentSessionMutateAsync: vi.fn(),
  startSessionMutate: vi.fn(),
  startSessionMutateAsync: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignMocks.useCampaign(),
}))

vi.mock('../use-live-game-session', () => ({
  useLiveGameSession: () => ({
    currentSession: sessionMocks.sessionQueryState.currentSession,
    sessions: sessionMocks.sessionQueryState.sessions,
    startSession: {
      isPending: false,
      mutate: sessionMocks.startSessionMutate,
      mutateAsync: sessionMocks.startSessionMutateAsync,
    },
    endCurrentSession: {
      isPending: false,
      mutate: sessionMocks.endCurrentSessionMutate,
      mutateAsync: sessionMocks.endCurrentSessionMutateAsync,
    },
    setCurrentSession: {
      isPending: false,
      mutate: sessionMocks.setCurrentSessionMutate,
      mutateAsync: sessionMocks.setCurrentSessionMutateAsync,
    },
    nextSessionNumber: 1,
  }),
}))

beforeEach(() => {
  campaignMocks.useCampaign.mockReset()
  campaignMocks.useCampaign.mockReturnValue({
    campaign: { data: { acceptedMemberCount: 2, name: 'Test Campaign' } },
    isDm: true,
  })
  sessionMocks.startSessionMutate.mockReset()
  sessionMocks.startSessionMutateAsync.mockReset()
  sessionMocks.endCurrentSessionMutate.mockReset()
  sessionMocks.endCurrentSessionMutateAsync.mockReset()
  sessionMocks.setCurrentSessionMutate.mockReset()
  sessionMocks.setCurrentSessionMutateAsync.mockReset()
  sessionMocks.startSessionMutateAsync.mockResolvedValue('started-session')
  sessionMocks.endCurrentSessionMutateAsync.mockResolvedValue('ended-session')
  sessionMocks.setCurrentSessionMutateAsync.mockResolvedValue('selected-session')
  sessionMocks.sessionQueryState.currentSession = { data: null, isPending: false }
  sessionMocks.sessionQueryState.sessions = { data: [], isPending: false }
})

describe('useLiveCampaignPanelSource', () => {
  it('returns awaitable session mutation outcomes', async () => {
    const { result } = renderHook(() => useLiveCampaignPanelSource())

    await expect(result.current.sessionActions.startSession()).resolves.toBe('started-session')
    await expect(result.current.sessionActions.endCurrentSession()).resolves.toBe('ended-session')
    await expect(
      result.current.sessionActions.setCurrentSession('session-1' as SessionId),
    ).resolves.toBe('selected-session')

    expect(sessionMocks.startSessionMutate).not.toHaveBeenCalled()
    expect(sessionMocks.endCurrentSessionMutate).not.toHaveBeenCalled()
    expect(sessionMocks.setCurrentSessionMutate).not.toHaveBeenCalled()
    expect(sessionMocks.setCurrentSessionMutateAsync).toHaveBeenCalledWith({
      sessionId: 'session-1',
    })
  })

  it('reports session loading while session queries are pending', () => {
    sessionMocks.sessionQueryState.currentSession = { data: null, isPending: true }
    sessionMocks.sessionQueryState.sessions = { data: [], isPending: false }

    const { result } = renderHook(() => useLiveCampaignPanelSource())

    expect(result.current.isLoadingSessions).toBe(true)
  })

  it('reports session loading while the sessions list query is pending', () => {
    sessionMocks.sessionQueryState.currentSession = { data: null, isPending: false }
    sessionMocks.sessionQueryState.sessions = { data: [], isPending: true }

    const { result } = renderHook(() => useLiveCampaignPanelSource())

    expect(result.current.isLoadingSessions).toBe(true)
  })
})
