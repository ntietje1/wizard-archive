import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import { useSidebarItemAvailabilityState } from '../useSidebarItemAvailabilityState'
import type { Id } from 'convex/_generated/dataModel'
import type { NoteWithContent } from 'shared/notes/types'
import { SIDEBAR_ITEM_STATUS } from 'shared/sidebar-items/types'

const activeItemsState = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>>,
  itemsMap: new Map<string, Record<string, unknown>>(),
  status: 'success' as 'pending' | 'error' | 'success',
}))
const campaignState = vi.hoisted(() => ({
  campaignId: 'campaign-1' as Id<'campaigns'> | undefined,
  isDm: true as boolean | undefined,
}))
const viewAsState = vi.hoisted(() => ({
  viewAsPlayer: null as { campaignId: Id<'campaigns'>; memberId: Id<'campaignMembers'> } | null,
  setViewAsPlayer: vi.fn(),
}))
const campaignMembersState = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>>,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeItemsState,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useSidebarUIStore: (selector: (state: typeof viewAsState) => unknown) => selector(viewAsState),
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => campaignMembersState,
}))

describe('useSidebarItemAvailabilityState', () => {
  beforeEach(() => {
    const metadata = createNote({
      _id: createItemId('note-1'),
      name: 'Secret Note',
      slug: 'secret-note',
    })
    activeItemsState.data = [metadata]
    activeItemsState.itemsMap = new Map([[metadata._id, metadata]])
    activeItemsState.status = 'success'
    campaignState.campaignId = testId<'campaigns'>('campaign-1')
    campaignState.isDm = true
    viewAsState.viewAsPlayer = null
    viewAsState.setViewAsPlayer.mockReset()
    campaignMembersState.data = []
  })

  it('returns available when readable content is available and viewable', () => {
    const readableItem: NoteWithContent = {
      ...createNote({ _id: createItemId('note-1'), name: 'Secret Note' }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem,
        canView: true,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'available',
      item: readableItem,
      label: 'Secret Note',
    })
  })

  it('returns trashed when readable content is in the trash', () => {
    const readableItem: NoteWithContent = {
      ...createNote({
        _id: createItemId('note-1'),
        name: 'Secret Note',
        status: SIDEBAR_ITEM_STATUS.trashed,
      }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem,
        canView: true,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'trashed',
      label: 'Secret Note',
      message: 'This item is in the trash.',
    })
    expect(result.current).not.toHaveProperty('item')
  })

  it('returns item not_shared copy when metadata exists but content is not viewable', () => {
    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem: null,
        canView: false,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_shared',
      label: 'Secret Note',
      message: "This item isn't shared with you.",
    })
  })

  it('returns page not_shared copy for full editor view-as mode', () => {
    viewAsState.viewAsPlayer = {
      campaignId: testId<'campaigns'>('campaign-1'),
      memberId: testId<'campaignMembers'>('player-1'),
    }
    campaignMembersState.data = [
      {
        _id: testId<'campaignMembers'>('player-1'),
        campaignId: testId<'campaigns'>('campaign-1'),
        role: 'Player',
        status: 'Accepted',
        userProfile: { name: 'Mina', username: 'mina' },
      },
    ]

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'slug', slug: 'secret-note' },
        readableItem: null,
        canView: false,
        subject: 'page',
        fallbackLabel: 'Page',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_shared',
      message: "This page isn't shared with Mina.",
    })
  })

  it('returns not_found when a DM can tell the target does not exist', () => {
    activeItemsState.data = []
    activeItemsState.itemsMap = new Map()

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'slug', slug: 'missing' },
        readableItem: null,
        canView: false,
        subject: 'page',
        fallbackLabel: 'Page',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_found',
      message: "This page doesn't exist.",
    })
  })

  it('returns ambiguous copy for non-DM missing or inaccessible targets', () => {
    activeItemsState.data = []
    activeItemsState.itemsMap = new Map()
    campaignState.isDm = false

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('missing') },
        readableItem: null,
        canView: false,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_found_or_not_shared',
      message: "This item doesn't exist or isn't shared with you.",
    })
  })

  it('stays loading while metadata or content state is pending', () => {
    activeItemsState.status = 'pending'

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem: null,
        readableItemLoading: true,
        canView: false,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'loading',
      label: 'Secret Note',
    })
  })

  it('returns the readable item error when metadata fails to load', () => {
    activeItemsState.data = []
    activeItemsState.itemsMap = new Map()
    activeItemsState.status = 'error'

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem: null,
        readableItemError: new Error('fetch failed'),
        canView: false,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current.status).toBe('error')
    expect(result.current.message).toContain('fetch failed')
  })

  it('returns the readable item error when metadata is still pending', () => {
    activeItemsState.status = 'pending'

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem: null,
        readableItemError: new Error('fetch failed'),
        canView: false,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current.status).toBe('error')
    expect(result.current.message).toContain('fetch failed')
  })

  it('returns an error when active metadata fails to load', () => {
    activeItemsState.data = []
    activeItemsState.itemsMap = new Map()
    activeItemsState.status = 'error'

    const { result } = renderHook(() =>
      useSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: createItemId('note-1') },
        readableItem: null,
        canView: false,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'error',
      message: 'Failed to load item.',
    })
  })
})

function createItemId(value: string) {
  return testId<'sidebarItems'>(value)
}
