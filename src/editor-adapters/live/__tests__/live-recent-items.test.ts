import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testResourceId } from '../../../../shared/test/resource-id'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { addLiveRecentItem, useLiveRecentItems } from '../live-recent-items'

const workspaceState = vi.hoisted(() => ({ workspaceRecordId: 'campaign-1' as string | null }))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: workspaceState.workspaceRecordId }),
}))

describe('live recent items', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    workspaceState.workspaceRecordId = 'campaign-1'
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

  it('persists a recent item entry for the live workspace storage key', () => {
    const resourceId = testResourceId('my-note')
    addLiveRecentItem('campaign-1', resourceId)

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
    const ids = Array.from({ length: 100 }, (_, index) => testResourceId(`note-${index}`))
    storage['recent-resources-v1-campaign-1'] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        resourceId: ids[index],
        timestamp: index,
      })),
    )

    addLiveRecentItem('campaign-1', ids[50]!)

    const stored = JSON.parse(storage['recent-resources-v1-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].resourceId).toBe(ids[50])
    expect(typeof stored[0].timestamp).toBe('number')
    expect(
      stored.filter((entry: { resourceId: string }) => entry.resourceId === ids[50]),
    ).toHaveLength(1)
  })

  it('adds a new resource to the front and drops the oldest capped entry', () => {
    const ids = Array.from({ length: 100 }, (_, index) => testResourceId(`note-${index}`))
    const newResourceId = testResourceId('new-note')
    storage['recent-resources-v1-campaign-1'] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        resourceId: ids[index],
        timestamp: index,
      })),
    )

    addLiveRecentItem('campaign-1', newResourceId)

    const stored = JSON.parse(storage['recent-resources-v1-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].resourceId).toBe(newResourceId)
    expect(stored.some((entry: { resourceId: string }) => entry.resourceId === ids[99])).toBe(false)
  })

  it('projects valid persisted entries onto visible live workspace items', async () => {
    const first = createNote({ id: testResourceId('first'), name: 'First' })
    const second = createNote({ id: testResourceId('second'), name: 'Second' })
    storage['recent-resources-v1-campaign-1'] = JSON.stringify([
      { resourceId: testResourceId('missing'), timestamp: 3 },
      { resourceId: second.id, timestamp: 2 },
      { resourceId: first.id, timestamp: 1 },
      { resourceId: '', timestamp: 0 },
      { resourceId: testResourceId('missing-time') },
    ])

    const { result } = renderHook(() => useLiveRecentItems([first, second], (item) => item.name))

    await waitFor(() => {
      expect(result.current).toEqual(['Second', 'First'])
    })
  })
})
