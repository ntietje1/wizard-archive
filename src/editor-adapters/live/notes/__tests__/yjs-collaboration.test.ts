import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { useNoteYjsCollaboration } from '~/editor-adapters/live/notes/yjs-collaboration'

import { flushMicrotasks } from '~/test/helpers/async'

const NOTE_ID = 'test-note-id' as ResourceId
const OTHER_NOTE_ID = 'other-test-note-id' as ResourceId
const CAMPAIGN_ID = testCampaignId('test-campaign-id')
const USER = { name: 'Test User', color: '#ff0000' }
const PROVIDER = { awareness: {} }

const {
  mockAction,
  mockConvexClient,
  mockInvalidateQueries,
  mockFlushPendingUpdates,
  mockIsApplyingRemoteUpdate,
  mockUseConvexYjsCollaboration,
} = vi.hoisted(() => {
  const action = vi.fn().mockResolvedValue({ status: 'projected', throughSeq: 0 })
  return {
    mockAction: action,
    mockConvexClient: { action, mutation: vi.fn().mockResolvedValue(null) },
    mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
    mockFlushPendingUpdates: vi.fn().mockResolvedValue(true),
    mockIsApplyingRemoteUpdate: vi.fn().mockReturnValue(false),
    mockUseConvexYjsCollaboration: vi.fn(),
  }
})

vi.mock('convex/_generated/api', () => ({
  api: {
    notes: {
      actions: {
        persistNoteBlocks: 'persistNoteBlocks',
      },
    },
    noteValues: {
      queries: {
        getNoteValueStates: 'getNoteValueStates',
        getNoteValueStatesByNotes: 'getNoteValueStatesByNotes',
      },
    },
    sidebarItems: {
      queries: {
        resolveSidebarItemAccess: 'resolveSidebarItemAccess',
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

vi.mock('~/editor-adapters/live/collaboration/yjs-collaboration', () => ({
  useConvexYjsCollaboration: (...args: Array<unknown>) => mockUseConvexYjsCollaboration(...args),
}))

vi.mock('@wizard-archive/editor/adapter', async (importOriginal) => ({
  ...(await importOriginal()),
  flushWizardEditorYjsProviderPendingUpdates: mockFlushPendingUpdates,
  isWizardEditorYjsProviderApplyingRemoteUpdate: mockIsApplyingRemoteUpdate,
}))

describe('useNoteYjsCollaboration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockAction.mockClear()
    mockAction.mockResolvedValue({ status: 'projected', throughSeq: 0 })
    mockInvalidateQueries.mockClear()
    mockInvalidateQueries.mockResolvedValue(undefined)
    mockFlushPendingUpdates.mockClear()
    mockFlushPendingUpdates.mockResolvedValue(true)
    mockIsApplyingRemoteUpdate.mockClear()
    mockIsApplyingRemoteUpdate.mockReturnValue(false)
    mockUseConvexYjsCollaboration.mockReset()
    mockUseConvexYjsCollaboration.mockImplementation(
      (_sourceId: CampaignId, noteId: ResourceId) => ({
        doc: createSessionDoc(noteId),
        provider: PROVIDER,
        instanceId: noteId,
        isLoading: false,
        error: null,
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the live collaboration document and provider for the note', () => {
    const { result } = renderHook(() => useTestNoteYjsCollaboration(NOTE_ID, true))

    expect(mockUseConvexYjsCollaboration).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      NOTE_ID,
      USER,
      true,
      expect.any(Object),
    )
    expect(result.current.doc?.getMap('document-test').get('noteId')).toBe(NOTE_ID)
    expect(result.current.provider).toBe(PROVIDER)
  })

  it('invalidates every campaign note-value query shape after persisting a note', async () => {
    const callOrder: Array<string> = []
    mockFlushPendingUpdates.mockImplementationOnce(() => {
      callOrder.push('flush')
      return Promise.resolve(true)
    })
    mockAction.mockImplementation((actionName: string) => {
      if (actionName === 'persistNoteBlocks') callOrder.push('persist')
      return Promise.resolve({ status: 'projected', throughSeq: 0 })
    })

    const { result } = renderHook(() => useTestNoteYjsCollaboration(NOTE_ID, true))

    result.current.doc!.getMap('document-test').set('value', 'changed')

    await vi.advanceTimersByTimeAsync(750)
    await flushMicrotasks(10)

    expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
      campaignId: CAMPAIGN_ID,
      documentId: NOTE_ID,
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        'convexQuery',
        'resolveSidebarItemAccess',
        {
          campaignId: CAMPAIGN_ID,
          lookup: { kind: 'id', id: NOTE_ID },
        },
      ],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['convexQuery', 'getNoteValueStates', { campaignId: CAMPAIGN_ID, noteId: NOTE_ID }],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['convexQuery', 'getNoteValueStatesByNotes', { campaignId: CAMPAIGN_ID }],
    })
    expect(callOrder.slice(0, 2)).toEqual(['flush', 'persist'])
  })

  it('does not invalidate projected content when the server rejects an invalid document', async () => {
    mockAction.mockResolvedValueOnce({ status: 'rejected', reason: 'invalid_document' })
    const { result } = renderHook(() => useTestNoteYjsCollaboration(NOTE_ID, true))

    result.current.doc!.getMap('document-test').set('value', 'invalid')
    await vi.advanceTimersByTimeAsync(750)
    await flushMicrotasks(10)

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('persists the previous live note when the editor collaboration session cleans up', async () => {
    let resolveFlush!: () => void
    mockFlushPendingUpdates.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveFlush = () => resolve(true)
      }),
    )

    const { rerender } = renderHook(({ noteId }) => useTestNoteYjsCollaboration(noteId, true), {
      initialProps: { noteId: NOTE_ID },
    })
    const firstOptions = mockUseConvexYjsCollaboration.mock.calls[0][4]

    rerender({ noteId: OTHER_NOTE_ID })

    const cleanup = firstOptions.onBeforeDestroy({
      documentId: NOTE_ID,
      provider: PROVIDER,
      sourceId: CAMPAIGN_ID,
    })

    await Promise.resolve()
    resolveFlush()
    await cleanup
    await flushMicrotasks(10)

    expect(mockAction).toHaveBeenCalledWith('persistNoteBlocks', {
      campaignId: CAMPAIGN_ID,
      documentId: NOTE_ID,
    })
  })
})

function useTestNoteYjsCollaboration(noteId: ResourceId, canEdit: boolean) {
  return useNoteYjsCollaboration(CAMPAIGN_ID, noteId, USER, canEdit)
}

function createSessionDoc(noteId: ResourceId) {
  const doc = new Y.Doc()
  doc.getMap('document-test').set('noteId', noteId)
  return doc
}
