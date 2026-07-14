import { testResourceId } from '../../../../../shared/test/resource-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { WizardEditorCanvasSessionPortsInput } from '@wizard-archive/editor/adapter'
import {
  useLiveCanvasEmbeddedSessionSource,
  useLiveCanvasSessionSource,
} from '~/editor-adapters/live/canvas/session-source'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

const doc = vi.hoisted(() => ({
  getMap: vi.fn(() => new Map()),
}))

const collaborationMock = vi.hoisted(() =>
  vi.fn((_sourceId: unknown, _documentId: unknown, _user: unknown, _canEdit: unknown) => ({
    doc,
    provider: null,
    isLoading: false,
    error: null,
  })),
)

const authPaginatedQueryMock = vi.hoisted(() => vi.fn())
const useEmbeddedCanvasStateFromUpdatesMock = vi.hoisted(() => vi.fn())
type TestCanvasItemWithContent = Parameters<
  WizardEditorCanvasSessionPortsInput['documentSession']['useCanvasDocumentSession']
>[0]['canvas']
const TEST_RESOURCE_TYPES = {
  canvases: 'canvas',
} as const satisfies Record<string, TestCanvasItemWithContent['type']>

vi.mock('convex/_generated/api', () => ({
  api: {
    users: {
      queries: {
        getUserProfile: 'getUserProfile',
      },
    },
    yjsSync: {
      queries: {
        getUpdates: 'getUpdates',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({
    data: { id: testId<'userProfiles'>('user_1'), name: 'Mina', username: 'mina' },
    isLoading: false,
  }),
}))

vi.mock('~/shared/hooks/useAuthPaginatedQuery', () => ({
  useAuthPaginatedQuery: (...args: Array<unknown>) => authPaginatedQueryMock(...args),
}))

vi.mock('@wizard-archive/ui/theme/context', () => ({
  useResolvedTheme: () => 'light',
}))

vi.mock('~/editor-adapters/live/collaboration/yjs-collaboration', () => ({
  useConvexYjsCollaboration: (
    campaignId: unknown,
    documentId: unknown,
    user: unknown,
    canEdit: unknown,
  ) => collaborationMock(campaignId, documentId, user, canEdit),
}))

vi.mock('@wizard-archive/editor/adapter', async (importOriginal) => ({
  ...(await importOriginal()),
  useWizardEditorEmbeddedCanvasStateFromUpdates: useEmbeddedCanvasStateFromUpdatesMock,
}))

describe('useLiveCanvasSessionSource', () => {
  beforeEach(() => {
    collaborationMock.mockClear()
    doc.getMap.mockClear()
    authPaginatedQueryMock.mockReset()
    authPaginatedQueryMock.mockReturnValue({
      loadMore: vi.fn(),
      results: [],
      status: 'Exhausted',
    })
    useEmbeddedCanvasStateFromUpdatesMock.mockReset()
    useEmbeddedCanvasStateFromUpdatesMock.mockImplementation(({ canvasId, useUpdates }) => {
      const updates = useUpdates({ canvasId, afterSeq: 3 })
      return {
        nodes: [],
        edges: [],
        status: updates.isError
          ? 'unavailable'
          : updates.data === undefined
            ? 'loading'
            : 'available',
      }
    })
  })

  it('opens live canvas documents with the edit access granted by the workspace runtime', () => {
    const canvas = createCanvas({ myPermissionLevel: PERMISSION_LEVEL.EDIT })

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasSessionSource()
      return source.document.useCanvasDocumentSession(canvas)
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      canEdit: true,
      collaboration: { status: 'unavailable' },
    })
    expect(collaborationMock).toHaveBeenCalledWith(
      'campaign_1',
      canvas.id,
      expect.objectContaining({ name: 'Mina' }),
      true,
    )
  })

  it('keeps live canvas documents read-only when the workspace runtime denies edit access', () => {
    const canvas = createCanvas()

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasSessionSource({ canEdit: false })
      return source.document.useCanvasDocumentSession(canvas)
    })

    expect(result.current).toMatchObject({ status: 'ready', canEdit: false })
    expect(collaborationMock).toHaveBeenCalledWith(
      'campaign_1',
      canvas.id,
      expect.objectContaining({ name: 'Mina' }),
      false,
    )
  })

  it('exposes the live collaboration provider as an available capability', () => {
    const provider = { awareness: {}, flushUpdates: vi.fn() }
    collaborationMock.mockReturnValueOnce({
      doc,
      provider: provider as never,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasSessionSource()
      return source.document.useCanvasDocumentSession(createCanvas())
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      collaboration: { status: 'available', provider },
    })
  })

  it('supplies live Yjs updates to the editor package embedded canvas state hook', () => {
    const canvasId = createTestCanvasId('canvas-1')
    const update = new Uint8Array([1, 2, 3])
    authPaginatedQueryMock.mockReturnValue({
      loadMore: vi.fn(),
      results: [{ seq: 4, update }],
      status: 'Exhausted',
    })

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasEmbeddedSessionSource()
      return source.embeddedCanvas.useEmbeddedCanvasState(canvasId)
    })

    expect(useEmbeddedCanvasStateFromUpdatesMock).toHaveBeenCalledWith({
      canvasId,
      useUpdates: expect.any(Function),
    })
    expect(authPaginatedQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        campaignId: 'campaign_1',
        documentId: canvasId,
        afterSeq: 3,
      },
      { initialNumItems: 100 },
    )
    expect(result.current).toEqual({
      nodes: [],
      edges: [],
      status: 'available',
    })
  })

  it('skips live Yjs update reads for non-persisted embedded canvas ids', () => {
    const canvasId = 'optimistic-canvas-1' as ResourceId

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasEmbeddedSessionSource()
      return source.embeddedCanvas.useEmbeddedCanvasState(canvasId)
    })

    expect(authPaginatedQueryMock).toHaveBeenCalledWith(expect.anything(), 'skip', {
      initialNumItems: 100,
    })
    expect(result.current).toEqual({
      nodes: [],
      edges: [],
      status: 'available',
    })
  })

  it('loads additional embedded canvas Yjs pages before exposing data', () => {
    const canvasId = createTestCanvasId('canvas-1')
    const loadMore = vi.fn()
    authPaginatedQueryMock.mockReturnValue({
      loadMore,
      results: [{ seq: 4, update: new Uint8Array([1]) }],
      status: 'CanLoadMore',
    })

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasEmbeddedSessionSource()
      return source.embeddedCanvas.useEmbeddedCanvasState(canvasId)
    })

    expect(loadMore).toHaveBeenCalledWith(100)
    expect(result.current.status).toBe('loading')
  })

  it('projects embedded canvas Yjs query errors as unavailable state', () => {
    authPaginatedQueryMock.mockReturnValue({
      isError: true,
      loadMore: vi.fn(),
      results: [],
      status: 'Exhausted',
    })

    const { result } = renderHook(() => {
      const source = useTestLiveCanvasEmbeddedSessionSource()
      return source.embeddedCanvas.useEmbeddedCanvasState(createTestCanvasId('canvas-1'))
    })

    expect(result.current).toEqual({ nodes: [], edges: [], status: 'unavailable' })
  })

  it('does not suppress embedded canvas Yjs query exceptions', () => {
    const failure = new Error('embedded canvas query failed')
    authPaginatedQueryMock.mockImplementation(() => {
      throw failure
    })

    expect(() =>
      renderHook(() => {
        const source = useTestLiveCanvasEmbeddedSessionSource()
        return source.embeddedCanvas.useEmbeddedCanvasState(createTestCanvasId('canvas-1'))
      }),
    ).toThrow(failure)
  })
})

function useTestLiveCanvasSessionSource({ canEdit = true }: { canEdit?: boolean } = {}) {
  return useLiveCanvasSessionSource({
    workspaceId: testId<'campaigns'>('campaign_1'),
    access: {
      canEditCanvas: () => canEdit,
    },
  })
}

function useTestLiveCanvasEmbeddedSessionSource() {
  return useLiveCanvasEmbeddedSessionSource({
    workspaceId: testId<'campaigns'>('campaign_1'),
  })
}

function createCanvas(
  overrides: Partial<TestCanvasItemWithContent> = {},
): TestCanvasItemWithContent {
  const { type: _type, ...baseItem } = createNote({
    id: testResourceId('canvas_1'),
    name: 'Canvas',
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  return {
    ...baseItem,
    type: TEST_RESOURCE_TYPES.canvases,
    ancestors: [],
    ...overrides,
  }
}

function createTestCanvasId(value: string): ResourceId {
  return testResourceId(value)
}
