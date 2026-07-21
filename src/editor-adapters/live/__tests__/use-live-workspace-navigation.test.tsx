import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from '~/editor-adapters/live/editor-route'
import {
  useLiveWorkspaceNavigation,
  useLiveWorkspaceSelectedTarget,
} from '../use-live-workspace-navigation'

const navigateMock = vi.hoisted(() => vi.fn())
const useMatchMock = vi.hoisted(() => vi.fn())
const campaignId = vi.hoisted(() => '018f2e40-7c00-7000-8000-000000000001')
const campaignSlug = 'storm-king'
const dmUsername = 'mira'
const lastResourceState = vi.hoisted(() => ({
  lastSelectedResourceSearch: null as Record<string, unknown> | null,
  setLastSelectedResource: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useMatch: useMatchMock,
  useNavigate: () => navigateMock,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId,
    campaignSlug,
    dmUsername,
  }),
}))

vi.mock('~/editor-adapters/live/use-last-resource', () => ({
  useLastResource: () => lastResourceState,
}))

describe('useLiveWorkspaceNavigation', () => {
  const resourceId = testDomainId('resource', 'scene-one')
  beforeEach(() => {
    navigateMock.mockReset()
    useMatchMock.mockReset()
    lastResourceState.lastSelectedResourceSearch = null
    lastResourceState.setLastSelectedResource.mockReset()
    vi.restoreAllMocks()
  })

  it('reads the selected canonical target from the shared editor route', () => {
    const blockId = testDomainId('noteBlock', 'arrival')
    useMatchMock.mockReturnValue({
      search: {
        resource: resourceId,
        target: 'noteBlock',
        targetId: blockId,
        presentation: 'heading',
      },
    })

    const { result } = renderHook(() => useLiveWorkspaceSelectedTarget())

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(result.current).toEqual({
      kind: 'noteBlock',
      resourceId,
      blockId,
      presentation: 'heading',
    })
  })

  it('navigates to an exact target and records its resource as the latest resource', async () => {
    const blockId = testDomainId('noteBlock', 'arrival')
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.navigateToTarget(
        { kind: 'noteBlock', resourceId, blockId, presentation: 'heading' },
        true,
      )
    })

    expect(lastResourceState.setLastSelectedResource).toHaveBeenCalledExactlyOnceWith(resourceId)
    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignSlug, dmUsername },
      search: {
        resource: resourceId,
        target: 'noteBlock',
        targetId: blockId,
        presentation: 'heading',
      },
      replace: true,
    })
  })

  it('opens the trash route through the shared editor route', async () => {
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.navigateToTrash()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignSlug, dmUsername },
      search: { trash: true },
      replace: undefined,
    })
  })

  it('opens the last editor resource using the stored route search', async () => {
    lastResourceState.lastSelectedResourceSearch = { resource: resourceId }

    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.openLastResource()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignSlug, dmUsername },
      search: { resource: resourceId },
      replace: undefined,
    })
  })

  it('opens the editor root when no last resource is stored', async () => {
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.openLastResource()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignSlug, dmUsername },
      search: {},
      replace: undefined,
    })
  })

  it('keeps the last selected resource when opening the create dashboard', async () => {
    lastResourceState.lastSelectedResourceSearch = { resource: resourceId }
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.clearWorkspaceContent()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignSlug, dmUsername },
      search: {},
      replace: undefined,
    })
    expect(lastResourceState.setLastSelectedResource).not.toHaveBeenCalled()
  })

  it('opens the campaign dashboard through the live navigation adapter', async () => {
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.openCampaignsDashboard()
    })

    expect(navigateMock).toHaveBeenCalledWith({ to: '/campaigns' })
  })
})
