import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { addLiveRecentResource } from '../live-recent-resources'

describe('live recent resources', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return storage[key] ?? null
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storage[key] = value
    })
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists a recent resource entry for the live workspace storage key', () => {
    const resourceId = testDomainId('resource', 'my-note')
    addLiveRecentResource('campaign-1', resourceId)

    const stored = JSON.parse(storage['recent-resources-v1-campaign-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0].resourceId).toBe(resourceId)
    expect(typeof stored[0].timestamp).toBe('number')
    expect(window.dispatchEvent).toHaveBeenCalledOnce()
    const event = vi.mocked(window.dispatchEvent).mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('localStorageChange')
    expect(event.detail.key).toBe('recent-resources-v1-campaign-1')
  })

  it('moves the most recent resource to the front and caps the live workspace history', () => {
    const ids = Array.from({ length: 100 }, (_, index) => testDomainId('resource', `note-${index}`))
    storage['recent-resources-v1-campaign-1'] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        resourceId: ids[index],
        timestamp: index,
      })),
    )

    addLiveRecentResource('campaign-1', ids[50]!)

    const stored = JSON.parse(storage['recent-resources-v1-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].resourceId).toBe(ids[50])
    expect(typeof stored[0].timestamp).toBe('number')
    expect(
      stored.filter((entry: { resourceId: string }) => entry.resourceId === ids[50]),
    ).toHaveLength(1)
  })

  it('adds a new resource to the front and drops the oldest capped entry', () => {
    const ids = Array.from({ length: 100 }, (_, index) => testDomainId('resource', `note-${index}`))
    const newResourceId = testDomainId('resource', 'new-note')
    storage['recent-resources-v1-campaign-1'] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        resourceId: ids[index],
        timestamp: index,
      })),
    )

    addLiveRecentResource('campaign-1', newResourceId)

    const stored = JSON.parse(storage['recent-resources-v1-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].resourceId).toBe(newResourceId)
    expect(stored.some((entry: { resourceId: string }) => entry.resourceId === ids[99])).toBe(false)
  })
})
