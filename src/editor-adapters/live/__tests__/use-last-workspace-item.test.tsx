import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testResourceId } from '../../../../shared/test/resource-id'
import { useLastWorkspaceItem } from '../use-last-workspace-item'

const workspaceState = vi.hoisted(() => ({
  workspaceRecordId: 'campaign_1' as string | undefined,
}))
const persistedState = vi.hoisted(() => ({
  key: null as string | null,
  value: null as string | null,
  setValue: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: workspaceState.workspaceRecordId }),
}))

vi.mock('@wizard-archive/ui/hooks/use-persisted-state', () => ({
  default: (key: string | null) => {
    persistedState.key = key
    return [persistedState.value, persistedState.setValue]
  },
}))

describe('useLastWorkspaceItem', () => {
  const resourceId = testResourceId('last-note')
  beforeEach(() => {
    workspaceState.workspaceRecordId = 'campaign_1'
    persistedState.key = null
    persistedState.value = null
    persistedState.setValue.mockClear()
    persistedState.setValue.mockImplementation((next: string | null) => {
      persistedState.value = next
    })
  })

  it('uses the current workspace scoped persistence key', () => {
    renderHook(() => useLastWorkspaceItem())

    expect(persistedState.key).toBe('last-editor-resource-v1-campaign_1')
  })

  it('projects the stored resource UUID into workspace search', () => {
    persistedState.value = resourceId

    const { result } = renderHook(() => useLastWorkspaceItem())

    expect(result.current.lastSelectedItem).toBe(resourceId)
    expect(result.current.lastSelectedWorkspaceItemSearch).toEqual({ item: resourceId })
  })

  it('drops pre-cutover stored slugs', () => {
    persistedState.value = '../private-note'

    const { result } = renderHook(() => useLastWorkspaceItem())

    expect(result.current.lastSelectedItem).toBeNull()
    expect(result.current.lastSelectedWorkspaceItemSearch).toBeUndefined()
  })

  it('does not read a workspace scoped key without a workspace context', () => {
    workspaceState.workspaceRecordId = undefined

    renderHook(() => useLastWorkspaceItem())

    expect(persistedState.key).toBeNull()
  })

  it('stores the selected resource UUID', () => {
    const { result } = renderHook(() => useLastWorkspaceItem())

    act(() => {
      result.current.setLastSelectedItem(resourceId)
    })

    expect(persistedState.setValue).toHaveBeenCalledExactlyOnceWith(resourceId)
    expect(persistedState.value).toBe(resourceId)
  })
})
