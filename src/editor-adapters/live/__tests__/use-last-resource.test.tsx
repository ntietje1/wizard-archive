import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { useLastResource } from '../use-last-resource'

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

describe('useLastResource', () => {
  const resourceId = testDomainId('resource', 'last-note')
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
    renderHook(() => useLastResource())

    expect(persistedState.key).toBe('last-editor-resource-v1-campaign_1')
  })

  it('projects the stored resource UUID into workspace search', () => {
    persistedState.value = resourceId

    const { result } = renderHook(() => useLastResource())

    expect(result.current.lastSelectedResource).toBe(resourceId)
    expect(result.current.lastSelectedResourceSearch).toEqual({ item: resourceId })
  })

  it('drops pre-cutover stored slugs', () => {
    persistedState.value = '../private-note'

    const { result } = renderHook(() => useLastResource())

    expect(result.current.lastSelectedResource).toBeNull()
    expect(result.current.lastSelectedResourceSearch).toBeUndefined()
  })

  it('does not read a workspace scoped key without a workspace context', () => {
    workspaceState.workspaceRecordId = undefined

    renderHook(() => useLastResource())

    expect(persistedState.key).toBeNull()
  })

  it('stores the selected resource UUID', () => {
    const { result } = renderHook(() => useLastResource())

    act(() => {
      result.current.setLastSelectedResource(resourceId)
    })

    expect(persistedState.setValue).toHaveBeenCalledExactlyOnceWith(resourceId)
    expect(persistedState.value).toBe(resourceId)
  })
})
