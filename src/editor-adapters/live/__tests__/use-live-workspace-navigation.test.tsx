import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testResourceId } from '../../../../shared/test/resource-id'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from '~/editor-adapters/live/editor-route'
import {
  useLiveWorkspaceNavigation,
  useLiveWorkspaceSelectedResourceId,
} from '../use-live-workspace-navigation'

const navigateMock = vi.hoisted(() => vi.fn())
const useMatchMock = vi.hoisted(() => vi.fn())
const lastWorkspaceItemState = vi.hoisted(() => ({
  lastSelectedWorkspaceItemSearch: null as Record<string, unknown> | null,
  setLastSelectedItem: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useMatch: useMatchMock,
  useNavigate: () => navigateMock,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignSlug: 'campaign',
    dmUsername: 'dm',
  }),
}))

vi.mock('~/editor-adapters/live/use-last-workspace-item', () => ({
  useLastWorkspaceItem: () => lastWorkspaceItemState,
}))

describe('useLiveWorkspaceNavigation', () => {
  const resourceId = testResourceId('scene-one')
  beforeEach(() => {
    navigateMock.mockReset()
    useMatchMock.mockReset()
    lastWorkspaceItemState.lastSelectedWorkspaceItemSearch = null
    lastWorkspaceItemState.setLastSelectedItem.mockReset()
    vi.restoreAllMocks()
  })

  it('reads the selected resource UUID from the shared editor route', () => {
    useMatchMock.mockReturnValue({ search: { item: resourceId } })

    const { result } = renderHook(() => useLiveWorkspaceSelectedResourceId())

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(result.current).toBe(resourceId)
  })

  it('navigates to an item and records it as the latest workspace item', async () => {
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.navigateToItem(resourceId, {
        heading: 'arrival',
        replace: true,
      })
    })

    expect(lastWorkspaceItemState.setLastSelectedItem).toHaveBeenCalledExactlyOnceWith(resourceId)
    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { dmUsername: 'dm', campaignSlug: 'campaign' },
      search: { item: resourceId, heading: 'arrival' },
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
      params: { dmUsername: 'dm', campaignSlug: 'campaign' },
      search: { trash: true },
      replace: undefined,
    })
  })

  it('opens the last editor item using the stored route search', async () => {
    lastWorkspaceItemState.lastSelectedWorkspaceItemSearch = { item: resourceId, heading: 'scene' }

    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.openLastWorkspaceItem()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { dmUsername: 'dm', campaignSlug: 'campaign' },
      search: { item: resourceId, heading: 'scene' },
      replace: undefined,
    })
  })

  it('opens the editor root when no last item is stored', async () => {
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.openLastWorkspaceItem()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { dmUsername: 'dm', campaignSlug: 'campaign' },
      search: {},
      replace: undefined,
    })
  })

  it('keeps the last selected item when opening the create dashboard', async () => {
    lastWorkspaceItemState.lastSelectedWorkspaceItemSearch = { item: resourceId }
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.clearWorkspaceContent()
    })

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { dmUsername: 'dm', campaignSlug: 'campaign' },
      search: {},
      replace: undefined,
    })
    expect(lastWorkspaceItemState.setLastSelectedItem).not.toHaveBeenCalled()
  })

  it('opens the campaign dashboard through the live navigation adapter', async () => {
    const { result } = renderHook(() => useLiveWorkspaceNavigation())

    await act(async () => {
      await result.current.openCampaignsDashboard()
    })

    expect(navigateMock).toHaveBeenCalledWith({ to: '/campaigns' })
  })
})
