import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  LIVE_YJS_PERSIST_DEBOUNCE_MS,
  PERSIST_INTERVAL_MS,
  useNoteYjsCollaboration,
} from '../useNoteYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'
import { flushMicrotasks } from '~/test/helpers/async'

const NOTE_ID = 'test-note-id' as Id<'sidebarItems'>
const OTHER_NOTE_ID = 'other-test-note-id' as Id<'sidebarItems'>
const USER = { name: 'Test User', color: '#ff0000' }

const { mockAction, mockMutation, mockConvexClient, mockUseAuthQuery, mockInvalidateQueries } =
  vi.hoisted(() => {
    const mutation = vi.fn().mockResolvedValue(null)
    const action = vi.fn().mockResolvedValue(null)
    return {
      mockAction: action,
      mockMutation: mutation,
      mockConvexClient: { action, mutation },
      mockUseAuthQuery: vi.fn().mockReturnValue({ data: undefined }),
      mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
    }
  })

vi.mock('convex/_generated/api', () => ({
  api: {
    yjsSync: {
      queries: { getUpdates: 'getUpdates', getAwareness: 'getAwareness' },
      mutations: {
        pushUpdate: 'pushUpdate',
        pushAwareness: 'pushAwareness',
        removeAwareness: 'removeAwareness',
      },
    },
    notes: {
      actions: {
        persistNoteBlocks: 'persistNoteBlocks',
      },
    },
    noteValues: {
      queries: {
        getNoteValueStates: 'getNoteValueStates',
      },
    },
    sidebarItems: {
      queries: {
        getSidebarItemBySlug: 'getSidebarItemBySlug',
      },
    },
  },
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => mockConvexClient,
  convexQuery: (_query: unknown, args: unknown) => ({ queryKey: ['convexQuery', _query, args] }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal()),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'test-campaign-id' }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({ data: [] }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => mockUseAuthQuery(...args),
}))

const mockProviderDestroy = vi.fn()
const mockFlushPendingUpdates = vi.fn().mockResolvedValue(true)
const mockSetUser = vi.fn()
const mockApplyRemoteUpdates = vi.fn()
const mockApplyRemoteAwareness = vi.fn()

vi.mock('../../providers/convex-yjs-provider', () => ({
  ConvexYjsProvider: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.destroy = mockProviderDestroy
    this.flushPendingUpdates = mockFlushPendingUpdates
    this.applyRemoteUpdates = mockApplyRemoteUpdates
    this.applyRemoteAwareness = mockApplyRemoteAwareness
    this.setUser = mockSetUser
    this.writable = false
    this.awareness = { setLocalStateField: vi.fn() }
    this.lastAppliedSeq = -1
  }),
}))

describe('useNoteYjsCollaboration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockAction.mockClear()
    mockAction.mockResolvedValue(null)
    mockMutation.mockClear()
    mockMutation.mockResolvedValue(null)
    mockInvalidateQueries.mockClear()
    mockInvalidateQueries.mockResolvedValue(undefined)
    mockUseAuthQuery.mockReturnValue({ data: undefined })
    mockProviderDestroy.mockClear()
    mockFlushPendingUpdates.mockClear()
    mockFlushPendingUpdates.mockResolvedValue(true)
    mockSetUser.mockClear()
    mockApplyRemoteUpdates.mockClear()
    mockApplyRemoteAwareness.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns doc and provider when rendered', () => {
    const { result } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
    expect(result.current.doc).not.toBeNull()
    expect(result.current.provider).not.toBeNull()
  })

  describe('persist interval', () => {
    it('flushes local Yjs updates before fast derived-data persist', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const callOrder: Array<string> = []
      mockFlushPendingUpdates.mockImplementationOnce(() => {
        callOrder.push('flush')
        return Promise.resolve()
      })
      mockAction.mockImplementation((actionName: string) => {
        if (actionName === 'persistNoteBlocks') callOrder.push('persist')
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)

      result.current.doc!.getMap('document-test').set('value', 'changed')

      await vi.advanceTimersByTimeAsync(LIVE_YJS_PERSIST_DEBOUNCE_MS)
      await flushMicrotasks(10)

      expect(mockFlushPendingUpdates).toHaveBeenCalled()
      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
      expect(callOrder).toEqual(['flush', 'persist'])
    })

    it('treats provider-origin editor updates as local when the provider is not applying remote updates', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { result } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)

      result.current.doc!.transact(() => {
        result.current.doc!.getMap('document-test').set('provider-origin-local', 'changed')
      }, result.current.provider)

      await vi.advanceTimersByTimeAsync(LIVE_YJS_PERSIST_DEBOUNCE_MS)
      await flushMicrotasks(10)

      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
    })

    it('drains a pending fast derived-data persist during cleanup', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { result, unmount } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)

      result.current.doc!.getMap('document-test').set('value', 'changed')
      unmount()
      await flushMicrotasks(10)

      expect(mockFlushPendingUpdates).toHaveBeenCalled()
      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
    })

    it('does not fast-persist remote Yjs updates applied by the provider', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { result } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)
      mockAction.mockClear()

      result.current.provider!.isApplyingRemoteUpdate = true
      result.current.doc!.transact(() => {
        result.current.doc!.getMap('document-test').set('remote', 'changed')
      }, result.current.provider)
      result.current.provider!.isApplyingRemoteUpdate = false

      await vi.advanceTimersByTimeAsync(LIVE_YJS_PERSIST_DEBOUNCE_MS)
      await flushMicrotasks(10)

      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', expect.anything())
    })

    it('calls persistNoteBlocks after interval when canEdit and loaded', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))

      await vi.advanceTimersByTimeAsync(PERSIST_INTERVAL_MS)
      await flushMicrotasks(10)
      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
    })

    it('continues interval persistence after provider-backed persists complete', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))

      await vi.advanceTimersByTimeAsync(PERSIST_INTERVAL_MS)
      await flushMicrotasks(10)
      await vi.advanceTimersByTimeAsync(PERSIST_INTERVAL_MS)
      await flushMicrotasks(10)

      const persistCalls = mockAction.mock.calls
      expect(persistCalls).toHaveLength(2)
    })

    it('does not persist when canEdit is false', () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, false))

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS)
      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', expect.anything())
    })

    it('does not persist while still loading', () => {
      mockUseAuthQuery.mockReturnValue({ data: undefined })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS)
      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', expect.anything())
    })

    it('stops persist interval when canEdit changes to false', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { rerender } = renderHook(
        ({ canEdit }) => useNoteYjsCollaboration(NOTE_ID, USER, canEdit),
        { initialProps: { canEdit: true } },
      )

      await vi.advanceTimersByTimeAsync(PERSIST_INTERVAL_MS)
      await flushMicrotasks(10)
      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })

      mockAction.mockClear()
      rerender({ canEdit: false })
      await flushMicrotasks(10)
      mockAction.mockClear()

      await vi.advanceTimersByTimeAsync(PERSIST_INTERVAL_MS * 2)
      await flushMicrotasks(10)
      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', expect.anything())
    })

    it('cleans up interval and destroys provider on unmount', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { unmount } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)

      mockAction.mockClear()
      unmount()
      await flushMicrotasks(10)

      expect(mockFlushPendingUpdates).toHaveBeenCalled()
      const actionCountAfterCleanup = mockAction.mock.calls.length

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS * 2)
      expect(mockAction.mock.calls.length).toBe(actionCountAfterCleanup)

      await Promise.resolve()
      await flushMicrotasks(10)
      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
    })

    it('waits for pending provider flush before persisting during cleanup', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      let resolveFlush!: () => void
      mockFlushPendingUpdates.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveFlush = resolve
        }),
      )

      const { unmount } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)

      unmount()

      await Promise.resolve()
      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', expect.anything())

      resolveFlush()
      await flushMicrotasks(10)

      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
    })

    it('does not project persisted blocks after a failed cleanup flush', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })
      mockFlushPendingUpdates.mockResolvedValueOnce(false)

      const { unmount } = renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))
      await flushMicrotasks(10)

      unmount()
      await flushMicrotasks(10)

      expect(mockFlushPendingUpdates).toHaveBeenCalled()
      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', expect.anything())
    })

    it('persists the previous note when noteId changes', async () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      let resolveFlush!: () => void
      mockFlushPendingUpdates.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveFlush = resolve
        }),
      )

      const { rerender } = renderHook(({ noteId }) => useNoteYjsCollaboration(noteId, USER, true), {
        initialProps: { noteId: NOTE_ID },
      })

      rerender({ noteId: OTHER_NOTE_ID })

      await Promise.resolve()
      expect(mockAction).not.toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })

      resolveFlush()
      await flushMicrotasks(10)

      expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
        campaignId: 'test-campaign-id',
        documentId: NOTE_ID,
      })
    })
  })
})
