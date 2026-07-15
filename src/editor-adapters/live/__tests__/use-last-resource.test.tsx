import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { useLastResource } from '../use-last-resource'

const campaignState = vi.hoisted(() => ({ campaignId: '' }))
const persistedState = vi.hoisted(() => ({
  key: null as string | null,
  value: null as unknown,
  setValue: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('@wizard-archive/ui/hooks/use-persisted-state', () => ({
  default: (key: string | null, _fallback: unknown, parse: (value: unknown) => unknown) => {
    persistedState.key = key
    return [parse(persistedState.value), persistedState.setValue]
  },
}))

describe('useLastResource', () => {
  const campaignId = testDomainId('campaign', 'last-resource')
  const resourceId = testDomainId('resource', 'last-note')
  beforeEach(() => {
    campaignState.campaignId = campaignId
    persistedState.key = null
    persistedState.value = null
    persistedState.setValue.mockClear()
    persistedState.setValue.mockImplementation((next: unknown) => {
      persistedState.value = next
    })
  })

  it('uses the current workspace scoped persistence key', () => {
    renderHook(() => useLastResource())

    expect(persistedState.key).toBe(`last-editor-resource-v1-${campaignId}`)
  })

  it('projects the stored resource UUID into workspace search', () => {
    persistedState.value = resourceId

    const { result } = renderHook(() => useLastResource())

    expect(result.current.lastSelectedResource).toBe(resourceId)
    expect(result.current.lastSelectedResourceSearch).toEqual({ resource: resourceId })
  })

  it('rejects malformed stored resource ids', () => {
    persistedState.value = '../private-note'

    const { result } = renderHook(() => useLastResource())

    expect(result.current.lastSelectedResource).toBeNull()
    expect(result.current.lastSelectedResourceSearch).toBeUndefined()
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
