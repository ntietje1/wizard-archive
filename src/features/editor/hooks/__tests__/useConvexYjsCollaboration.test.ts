import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConvexYjsCollaboration } from '../useConvexYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'

const DOCUMENT_ID = 'test-doc-id' as Id<'notes'>
const OTHER_DOCUMENT_ID = 'other-doc-id' as Id<'notes'>
const USER = { name: 'Test User', color: '#ff0000' }

const {
  mockMutation,
  mockConvexClient,
  mockUseAuthQuery,
  mockProviderDestroy,
  mockApplyRemoteUpdates,
  mockApplyRemoteAwareness,
  mockSetUser,
  MockConvexYjsProvider,
} = vi.hoisted(() => {
  const mutation = vi.fn().mockResolvedValue(null)
  return {
    mockMutation: mutation,
    mockConvexClient: { mutation },
    mockUseAuthQuery: vi.fn().mockReturnValue({ data: undefined }),
    mockProviderDestroy: vi.fn(),
    mockApplyRemoteUpdates: vi.fn(),
    mockApplyRemoteAwareness: vi.fn(),
    mockSetUser: vi.fn(),
    MockConvexYjsProvider: vi.fn(),
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
        persistBlocks: 'persistBlocks',
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

vi.mock('../../providers/convex-yjs-provider', () => ({
  ConvexYjsProvider: MockConvexYjsProvider,
}))

describe('useConvexYjsCollaboration', () => {
  let lastProviderInstance: Record<string, unknown>

  beforeEach(() => {
    vi.useFakeTimers()
    mockMutation.mockResolvedValue(null)
    mockUseAuthQuery.mockReturnValue({ data: undefined })
    mockProviderDestroy.mockClear()
    mockApplyRemoteUpdates.mockClear()
    mockApplyRemoteAwareness.mockClear()
    mockSetUser.mockClear()

    MockConvexYjsProvider.mockImplementation(function (
      this: Record<string, unknown>,
      _doc: unknown,
      _documentId: unknown,
      _config: unknown,
    ) {
      this.destroy = mockProviderDestroy
      this.applyRemoteUpdates = mockApplyRemoteUpdates
      this.applyRemoteAwareness = mockApplyRemoteAwareness
      this.setUser = mockSetUser
      this.writable = false
      this.awareness = { setLocalStateField: vi.fn() }
      lastProviderInstance = this
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns isLoading true when queries have no data', () => {
    const { result } = renderHook(() =>
      useConvexYjsCollaboration(DOCUMENT_ID, USER, true),
    )
    expect(result.current.isLoading).toBe(true)
  })

  it('creates provider with config object', () => {
    renderHook(() => useConvexYjsCollaboration(DOCUMENT_ID, USER, true))

    expect(MockConvexYjsProvider).toHaveBeenCalledWith(
      expect.anything(),
      DOCUMENT_ID,
      expect.objectContaining({
        pushUpdate: expect.any(Function),
        pushAwareness: expect.any(Function),
        removeAwareness: expect.any(Function),
        persistBlocks: expect.any(Function),
      }),
    )
  })

  it('returns doc and provider after state initialization', () => {
    const { result } = renderHook(() =>
      useConvexYjsCollaboration(DOCUMENT_ID, USER, true),
    )
    expect(result.current.doc).not.toBeNull()
    expect(result.current.provider).not.toBeNull()
    expect(result.current.instanceId).toBeGreaterThan(0)
  })

  it('calls setUser on mount', () => {
    renderHook(() => useConvexYjsCollaboration(DOCUMENT_ID, USER, true))
    expect(mockSetUser).toHaveBeenCalledWith(USER)
  })

  it('updates user when user changes', () => {
    const { rerender } = renderHook(
      ({ user }) => useConvexYjsCollaboration(DOCUMENT_ID, user, true),
      { initialProps: { user: USER } },
    )

    mockSetUser.mockClear()

    const updatedUser = { name: 'New Name', color: '#00ff00' }
    rerender({ user: updatedUser })

    expect(mockSetUser).toHaveBeenCalledWith(updatedUser)
  })

  it('transitions isLoading to false when updates data arrives', () => {
    const { result, rerender } = renderHook(() =>
      useConvexYjsCollaboration(DOCUMENT_ID, USER, true),
    )
    expect(result.current.isLoading).toBe(true)

    mockUseAuthQuery.mockReturnValue({
      data: [{ seq: 0, update: new ArrayBuffer(0) }],
    })
    rerender()

    expect(result.current.isLoading).toBe(false)
  })

  it('applies remote updates when data arrives', () => {
    const updates = [{ seq: 0, update: new ArrayBuffer(0) }]
    mockUseAuthQuery.mockReturnValue({ data: updates })

    renderHook(() => useConvexYjsCollaboration(DOCUMENT_ID, USER, true))

    expect(mockApplyRemoteUpdates).toHaveBeenCalledWith(updates)
  })

  it('applies remote awareness when awareness data arrives', () => {
    const awarenessEntries = [
      { clientId: 999, state: new ArrayBuffer(0), updatedAt: Date.now() },
    ]

    let callCount = 0
    mockUseAuthQuery.mockImplementation(() => {
      callCount++
      if (callCount % 2 === 1) return { data: [] }
      return { data: awarenessEntries }
    })

    renderHook(() => useConvexYjsCollaboration(DOCUMENT_ID, USER, true))

    expect(mockApplyRemoteAwareness).toHaveBeenCalledWith(awarenessEntries)
  })

  it('destroys provider on unmount', () => {
    const { unmount } = renderHook(() =>
      useConvexYjsCollaboration(DOCUMENT_ID, USER, true),
    )
    unmount()
    expect(mockProviderDestroy).toHaveBeenCalled()
  })

  it('generates a new instanceId for each mount', () => {
    const { result: result1, unmount: unmount1 } = renderHook(() =>
      useConvexYjsCollaboration(DOCUMENT_ID, USER, true),
    )
    const firstId = result1.current.instanceId
    unmount1()

    const { result: result2 } = renderHook(() =>
      useConvexYjsCollaboration(DOCUMENT_ID, USER, true),
    )
    expect(result2.current.instanceId).toBeGreaterThan(firstId)
  })

  it('sets writable to true when canEdit is true', () => {
    renderHook(() => useConvexYjsCollaboration(DOCUMENT_ID, USER, true))
    expect(lastProviderInstance.writable).toBe(true)
  })

  it('sets writable to false when canEdit is false', () => {
    renderHook(() => useConvexYjsCollaboration(DOCUMENT_ID, USER, false))
    expect(lastProviderInstance.writable).toBe(false)
  })

  it('recreates provider when documentId changes', () => {
    const { result, rerender } = renderHook(
      ({ docId }) => useConvexYjsCollaboration(docId, USER, true),
      { initialProps: { docId: DOCUMENT_ID } },
    )

    const firstInstanceId = result.current.instanceId
    const constructorCallsBefore = MockConvexYjsProvider.mock.calls.length

    rerender({ docId: OTHER_DOCUMENT_ID })

    expect(mockProviderDestroy).toHaveBeenCalled()
    expect(MockConvexYjsProvider.mock.calls.length).toBeGreaterThan(
      constructorCallsBefore,
    )
    expect(result.current.instanceId).toBeGreaterThan(firstInstanceId)
  })
})
