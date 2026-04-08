import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  PERSIST_INTERVAL_MS,
  useNoteYjsCollaboration,
} from '../useNoteYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'

const NOTE_ID = 'test-note-id' as Id<'notes'>
const USER = { name: 'Test User', color: '#ff0000' }

const { mockMutation, mockConvexClient, mockUseAuthQuery } = vi.hoisted(() => {
  const mutation = vi.fn().mockResolvedValue(null)
  return {
    mockMutation: mutation,
    mockConvexClient: { mutation },
    mockUseAuthQuery: vi.fn().mockReturnValue({ data: undefined }),
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
      mutations: {
        persistNoteBlocks: 'persistNoteBlocks',
      },
    },
  },
}))

vi.mock('@convex-dev/react-query', () => ({
  useConvex: () => mockConvexClient,
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: (...args: Array<unknown>) => mockUseAuthQuery(...args),
}))

const mockProviderDestroy = vi.fn()
const mockSetUser = vi.fn()
const mockApplyRemoteUpdates = vi.fn()
const mockApplyRemoteAwareness = vi.fn()

vi.mock('../../providers/convex-yjs-provider', () => ({
  ConvexYjsProvider: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
  ) {
    this.destroy = mockProviderDestroy
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
    mockMutation.mockClear()
    mockMutation.mockResolvedValue(null)
    mockUseAuthQuery.mockReturnValue({ data: undefined })
    mockProviderDestroy.mockClear()
    mockSetUser.mockClear()
    mockApplyRemoteUpdates.mockClear()
    mockApplyRemoteAwareness.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns doc and provider when rendered', () => {
    const { result } = renderHook(() =>
      useNoteYjsCollaboration(NOTE_ID, USER, true),
    )
    expect(result.current.doc).not.toBeNull()
    expect(result.current.provider).not.toBeNull()
  })

  describe('persist interval', () => {
    it('calls persistNoteBlocks after interval when canEdit and loaded', () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS)
      expect(mockMutation).toHaveBeenCalledWith('persistNoteBlocks', {
        documentId: NOTE_ID,
      })
    })

    it('does not persist when canEdit is false', () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, false))

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS)
      expect(mockMutation).not.toHaveBeenCalledWith(
        'persistNoteBlocks',
        expect.anything(),
      )
    })

    it('does not persist while still loading', () => {
      mockUseAuthQuery.mockReturnValue({ data: undefined })

      renderHook(() => useNoteYjsCollaboration(NOTE_ID, USER, true))

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS)
      expect(mockMutation).not.toHaveBeenCalledWith(
        'persistNoteBlocks',
        expect.anything(),
      )
    })

    it('stops persist interval when canEdit changes to false', () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { rerender } = renderHook(
        ({ canEdit }) => useNoteYjsCollaboration(NOTE_ID, USER, canEdit),
        { initialProps: { canEdit: true } },
      )

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS)
      expect(mockMutation).toHaveBeenCalledWith('persistNoteBlocks', {
        documentId: NOTE_ID,
      })

      mockMutation.mockClear()
      rerender({ canEdit: false })

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS * 2)
      expect(mockMutation).not.toHaveBeenCalledWith(
        'persistNoteBlocks',
        expect.anything(),
      )
    })

    it('cleans up interval and destroys provider on unmount', () => {
      mockUseAuthQuery.mockReturnValue({
        data: [{ seq: 0, update: new ArrayBuffer(0) }],
      })

      const { unmount } = renderHook(() =>
        useNoteYjsCollaboration(NOTE_ID, USER, true),
      )

      unmount()

      expect(mockProviderDestroy).toHaveBeenCalled()

      mockMutation.mockClear()

      vi.advanceTimersByTime(PERSIST_INTERVAL_MS * 2)
      expect(mockMutation).not.toHaveBeenCalledWith(
        'persistNoteBlocks',
        expect.anything(),
      )
    })
  })
})
