import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { parseWizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
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
    addLiveRecentItem('campaign-1', testResourceSlug('my-note'))

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('my-note')
    expect(typeof stored[0].timestamp).toBe('number')
    expect(window.dispatchEvent).toHaveBeenCalledOnce()
    const event = vi.mocked(window.dispatchEvent).mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('localStorageChange')
    expect(event.detail.key).toBe('recent-items-campaign-1')
  })

  it('moves the most recent slug to the front and caps the live workspace history', () => {
    storage['recent-items-campaign-1'] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        slug: `note-${index}`,
        timestamp: index,
      })),
    )

    addLiveRecentItem('campaign-1', testResourceSlug('note-50'))

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].slug).toBe('note-50')
    expect(typeof stored[0].timestamp).toBe('number')
    expect(stored.filter((entry: { slug: string }) => entry.slug === 'note-50')).toHaveLength(1)
  })

  it('adds a new slug to the front and drops the oldest capped entry', () => {
    storage['recent-items-campaign-1'] = JSON.stringify(
      Array.from({ length: 100 }, (_, index) => ({
        slug: `note-${index}`,
        timestamp: index,
      })),
    )

    addLiveRecentItem('campaign-1', testResourceSlug('new-note'))

    const stored = JSON.parse(storage['recent-items-campaign-1'])
    expect(stored).toHaveLength(100)
    expect(stored[0].slug).toBe('new-note')
    expect(stored.some((entry: { slug: string }) => entry.slug === 'note-99')).toBe(false)
  })

  it('projects valid persisted entries onto visible live workspace items', async () => {
    const first = createNote({ name: 'First', slug: 'first' })
    const second = createNote({ name: 'Second', slug: 'second' })
    storage['recent-items-campaign-1'] = JSON.stringify([
      { slug: 'missing', timestamp: 3 },
      { slug: 'second', timestamp: 2 },
      { slug: 'first', timestamp: 1 },
      { slug: '', timestamp: 0 },
      { slug: 'missing-time' },
    ])

    const { result } = renderHook(() => useLiveRecentItems([first, second], (item) => item.name))

    await waitFor(() => {
      expect(result.current).toEqual(['Second', 'First'])
    })
  })
})

function testResourceSlug(value: string): WizardEditorResourceSlug {
  const slug = parseWizardEditorResourceSlug(value)
  if (!slug) {
    throw new Error(`Invalid test resource slug: ${value}`)
  }
  return slug
}
