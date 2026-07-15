import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { addLiveRecentResource, getLiveRecentResources } from '../live-recent-resources'

describe('live recent resources', () => {
  const campaignId = testDomainId('campaign', 'recent-resources')
  const actorId = testDomainId('campaignMember', 'recent-resources')
  const recentResourcesKey = `recent-resources-v1-${campaignId}-${actorId}`
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
    addLiveRecentResource(campaignId, actorId, resourceId)

    const stored = JSON.parse(storage[recentResourcesKey])
    expect(stored).toHaveLength(1)
    expect(stored[0].resourceId).toBe(resourceId)
    expect(typeof stored[0].timestamp).toBe('number')
    expect(window.dispatchEvent).toHaveBeenCalledOnce()
    const event = vi.mocked(window.dispatchEvent).mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('localStorageChange')
    expect(event.detail.key).toBe(recentResourcesKey)
  })

  it('isolates recents by actor within the same campaign', () => {
    const resourceId = testDomainId('resource', 'actor-note')
    const otherActorId = testDomainId('campaignMember', 'other-recent-user')
    addLiveRecentResource(campaignId, actorId, resourceId)

    expect(getLiveRecentResources(campaignId, actorId)).toEqual([resourceId])
    expect(getLiveRecentResources(campaignId, otherActorId)).toEqual([])
  })

  it('moves the most recent resource to the front and caps the live workspace history', () => {
    const ids = Array.from({ length: 100 }, (_, index) => testDomainId('resource', `note-${index}`))
    storage[recentResourcesKey] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        resourceId: ids[index],
        timestamp: index,
      })),
    )

    addLiveRecentResource(campaignId, actorId, ids[50]!)

    const stored = JSON.parse(storage[recentResourcesKey])
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
    storage[recentResourcesKey] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        resourceId: ids[index],
        timestamp: index,
      })),
    )

    addLiveRecentResource(campaignId, actorId, newResourceId)

    const stored = JSON.parse(storage[recentResourcesKey])
    expect(stored).toHaveLength(100)
    expect(stored[0].resourceId).toBe(newResourceId)
    expect(stored.some((entry: { resourceId: string }) => entry.resourceId === ids[99])).toBe(false)
  })
})
