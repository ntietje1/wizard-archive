import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CampaignPanelContent } from '../campaign-panel-content'
import type { CampaignPanelSource } from '../campaign-panel-source'
import type { Session } from 'shared/sessions/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { testDomainId } from 'shared/test/domain-id'

const settingsStoreMocks = vi.hoisted(() => ({
  open: vi.fn(),
}))
const loggerMocks = vi.hoisted(() => ({
  handleError: vi.fn(),
}))

vi.mock('~/features/settings/hooks/settings-store', () => ({
  useSettingsStore: (selector: (state: { open: typeof settingsStoreMocks.open }) => unknown) =>
    selector({ open: settingsStoreMocks.open }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: (...args: Array<unknown>) => loggerMocks.handleError(...args),
}))

beforeEach(() => {
  settingsStoreMocks.open.mockReset()
  loggerMocks.handleError.mockReset()
})

describe('CampaignPanelContent session actions', () => {
  it('shows session loading without empty-session actions', () => {
    renderPanel(createPanelSource({ isLoadingSessions: true }))

    expect(screen.getByText(/loading sessions/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start session/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resume session/i })).not.toBeInTheDocument()
  })

  it('reports a rejected start session action', async () => {
    const error = new Error('session unavailable')
    const source = createPanelSource({
      sessionActions: {
        ...createSessionActions(),
        startSession: vi.fn().mockRejectedValue(error),
      },
    })

    renderPanel(source)

    await userEvent.click(screen.getByRole('button', { name: /start session/i }))

    await waitFor(() =>
      expect(loggerMocks.handleError).toHaveBeenCalledWith(error, 'Failed to start session'),
    )
  })

  it('reports a rejected stop session action', async () => {
    const error = new Error('session unavailable')
    const source = createPanelSource({
      currentSession: createSession(),
      sessionActions: {
        ...createSessionActions(),
        endCurrentSession: vi.fn().mockRejectedValue(error),
      },
    })

    renderPanel(source)

    await userEvent.click(screen.getByRole('button', { name: /stop session/i }))

    await waitFor(() =>
      expect(loggerMocks.handleError).toHaveBeenCalledWith(error, 'Failed to stop session'),
    )
  })

  it('keeps resume choices open when setting the current session fails', async () => {
    const error = new Error('session rejected')
    const previousSession = createSession({
      id: testDomainId('session', 'session-previous'),
    })
    const setCurrentSession = vi.fn().mockRejectedValue(error)
    const source = createPanelSource({
      sessions: [previousSession],
      sessionActions: {
        ...createSessionActions(),
        setCurrentSession,
      },
    })

    renderPanel(source)
    await userEvent.click(screen.getByRole('button', { name: /resume session/i }))
    await userEvent.click(screen.getByRole('button', { name: /previous session/i }))

    await waitFor(() =>
      expect(loggerMocks.handleError).toHaveBeenCalledWith(error, 'Failed to resume session'),
    )
    expect(setCurrentSession).toHaveBeenCalledWith(previousSession.id)
    expect(screen.getByRole('button', { name: /previous session/i })).toBeInTheDocument()
  })

  it('closes resume choices after setting the current session succeeds', async () => {
    const previousSession = createSession({
      id: testDomainId('session', 'session-previous'),
    })
    const setCurrentSession = vi.fn().mockResolvedValue(previousSession.id)
    const source = createPanelSource({
      sessions: [previousSession],
      sessionActions: {
        ...createSessionActions(),
        setCurrentSession,
      },
    })

    renderPanel(source)
    await userEvent.click(screen.getByRole('button', { name: /resume session/i }))
    await userEvent.click(screen.getByRole('button', { name: /previous session/i }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /previous session/i })).not.toBeInTheDocument(),
    )
    expect(setCurrentSession).toHaveBeenCalledWith(previousSession.id)
    expect(loggerMocks.handleError).not.toHaveBeenCalled()
  })
})

function renderPanel(source: CampaignPanelSource) {
  return render(
    <CampaignPanelContent onClose={vi.fn()} onSwitchCampaign={vi.fn()} source={source} />,
  )
}

function createPanelSource(overrides: Partial<CampaignPanelSource> = {}): CampaignPanelSource {
  return {
    campaignName: 'Test Campaign',
    currentSession: null,
    isDm: true,
    isLoadingSessions: false,
    memberCount: 3,
    sessions: [],
    sessionActions: createSessionActions(),
    ...overrides,
  }
}

function createSessionActions(): CampaignPanelSource['sessionActions'] {
  return {
    endCurrentSession: vi.fn().mockResolvedValue(undefined),
    isEndingCurrentSession: false,
    isSettingCurrentSession: false,
    isStartingSession: false,
    setCurrentSession: vi.fn().mockResolvedValue(undefined),
    startSession: vi.fn().mockResolvedValue(undefined),
  }
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: testDomainId('session', 'session-1'),
    createdAt: 1,
    campaignId: 'campaign-1' as CampaignId,
    name: 'Previous Session',
    startedAt: Date.UTC(2026, 0, 1, 12, 0),
    endedAt: null,
    ...overrides,
  }
}
