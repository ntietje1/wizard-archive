import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addRecentItem } from '~/features/search/hooks/use-recent-items'

describe('addRecentItem', () => {
  let storage: Record<string, string>
  let getItemSpy: ReturnType<typeof vi.spyOn>
  let setItemSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    storage = {}
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return storage[key] ?? null
    })
    setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        storage[key] = value
      })
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds a new entry to empty storage', () => {
    addRecentItem('campaign-1', 'my-note')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('my-note')
    expect(typeof stored[0].timestamp).toBe('number')
  })

  it('moves an existing slug to the front', () => {
    storage['recent-items-campaign-1'] = JSON.stringify([
      { slug: 'first', timestamp: 1 },
      { slug: 'second', timestamp: 2 },
    ])

    addRecentItem('campaign-1', 'second')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored[0].slug).toBe('second')
    expect(stored[1].slug).toBe('first')
    expect(stored).toHaveLength(2)
  })

  it('trims to 100 entries', () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      slug: `note-${i}`,
      timestamp: i,
    }))
    storage['recent-items-campaign-1'] = JSON.stringify(entries)

    addRecentItem('campaign-1', 'new-note')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].slug).toBe('new-note')
    expect(stored[99].slug).toBe('note-98')
  })

  it('does nothing when campaignId is empty', () => {
    addRecentItem('', 'my-note')

    expect(getItemSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('dispatches a localStorageChange event', () => {
    addRecentItem('campaign-1', 'my-note')

    expect(window.dispatchEvent).toHaveBeenCalledOnce()
    const event = vi.mocked(window.dispatchEvent).mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('localStorageChange')
    expect(event.detail.key).toBe('recent-items-campaign-1')
  })

  it('handles corrupt JSON in localStorage', () => {
    storage['recent-items-campaign-1'] = '{not valid json'

    addRecentItem('campaign-1', 'my-note')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('my-note')
  })

  it('handles non-array JSON in localStorage', () => {
    storage['recent-items-campaign-1'] = '42'

    addRecentItem('campaign-1', 'my-note')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('my-note')
  })

  it('filters out invalid entries from storage', () => {
    storage['recent-items-campaign-1'] = JSON.stringify([
      { slug: 123, timestamp: 1 },
      { slug: 'valid', timestamp: 2 },
      null,
      'string',
    ])

    addRecentItem('campaign-1', 'new-note')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(2)
    expect(stored[0].slug).toBe('new-note')
    expect(stored[1].slug).toBe('valid')
  })

  it('stores an empty string slug without error', () => {
    addRecentItem('campaign-1', '')

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('')
  })

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => addRecentItem('campaign-1', 'my-note')).not.toThrow()
  })
})
