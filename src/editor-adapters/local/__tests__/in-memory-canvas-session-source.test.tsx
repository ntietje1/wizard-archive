import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import type { UserProfileId } from 'shared/common/ids'
import { testCampaignId } from 'shared/test/campaign-id'
import { testResourceId } from 'shared/test/resource-id'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type {
  WizardEditorEmbeddedCanvasState,
  WizardEditorItem,
  WizardEditorItemWithContent,
} from '@wizard-archive/editor/adapter'
import {
  useInMemoryCanvasEmbeddedSessionSource,
  useInMemoryCanvasSessionSource,
} from '../in-memory-canvas-session-source'

const workspaceId = 'workspace-1'
const canvasId = testResourceId('canvas-1')
const TEST_RESOURCE_LOCATION = {
  sidebar: 'sidebar',
} as const satisfies Record<string, WizardEditorItem['location']>
const TEST_RESOURCE_STATUS = {
  active: 'active',
} as const satisfies Record<string, WizardEditorItem['status']>
const TEST_RESOURCE_TYPES = {
  canvases: 'canvas',
} as const satisfies Record<string, WizardEditorItemWithContent['type']>
type LocalAvailableEmbeddedCanvasState = Extract<
  WizardEditorEmbeddedCanvasState,
  { status: 'available' }
>
type LocalCanvasDocumentEdge = LocalAvailableEmbeddedCanvasState['edges'][number]
type LocalCanvasDocumentNode = LocalAvailableEmbeddedCanvasState['nodes'][number]
type LocalCanvasItemWithContent = Extract<WizardEditorItemWithContent, { type: 'canvas' }>

test('in-memory canvas session source resolves embedded canvas payloads from supplied data', () => {
  const nodes: ReadonlyArray<LocalCanvasDocumentNode> = [
    {
      id: testCanvasNodeId('node-1'),
      type: 'text',
      position: { x: 12, y: 24 },
      width: 120,
      height: 80,
      data: {
        content: [
          {
            id: 'block-1',
            type: 'paragraph',
            props: {
              textAlignment: 'left',
              textColor: 'default',
              backgroundColor: 'default',
            },
            content: [{ type: 'text', text: 'Embedded canvas', styles: {} }],
            children: [],
          },
        ],
      },
    },
  ]
  const edges: ReadonlyArray<LocalCanvasDocumentEdge> = [
    {
      id: 'edge-1',
      source: testCanvasNodeId('node-1'),
      target: testCanvasNodeId('node-2'),
      type: 'straight',
    },
  ]
  const { result: source } = renderHook(() =>
    useInMemoryCanvasSessionSource({
      canEdit: false,
      getCanvasPayload: () => ({ edges, nodes }),
      user: { name: 'Local', color: '#61afef' },
      workspaceId,
    }),
  )
  const { result: embeds } = renderHook(() =>
    useInMemoryCanvasEmbeddedSessionSource({
      getEmbeddedCanvasPayload: () => ({ edges, nodes }),
    }),
  )
  const { result: session } = renderHook(() =>
    source.current.document.useCanvasDocumentSession(createCanvasItem()),
  )

  expect(embeds.current.embeddedCanvas.useEmbeddedCanvasState(canvasId)).toEqual({
    edges,
    nodes,
    status: 'available',
  })
  expect(session.current.status).toBe('ready')
  if (session.current.status !== 'ready') throw new Error('expected ready canvas session')
  expect(session.current.canEdit).toBe(false)
  expect(session.current.collaboration).toEqual({ status: 'unsupported' })
  expect(session.current.nodesMap.get(testCanvasNodeId('node-1'))).toEqual(nodes[0])
  expect(session.current.edgesMap.get('edge-1')).toEqual(edges[0])
  session.current.doc.destroy()
})

test('in-memory canvas sessions use the current workspace id after rerender', () => {
  const secondWorkspaceId = 'workspace-2'
  const payloads = new Map<string, StaticCanvasTestPayload>([
    [workspaceId, { edges: [], nodes: [createTextNode('workspace-1-node', 'First workspace')] }],
    [
      secondWorkspaceId,
      { edges: [], nodes: [createTextNode('workspace-2-node', 'Second workspace')] },
    ],
  ])
  const { result, rerender } = renderHook(
    ({ activeWorkspaceId }: { activeWorkspaceId: string }) => {
      const source = useInMemoryCanvasSessionSource({
        canEdit: true,
        getCanvasPayload: () => {
          const payload = payloads.get(activeWorkspaceId)
          if (!payload) throw new Error(`Missing test payload for ${activeWorkspaceId}`)
          return payload
        },
        user: { name: 'Local', color: '#61afef' },
        workspaceId: activeWorkspaceId,
      })
      return source.document.useCanvasDocumentSession(
        createCanvasItem({ workspaceId: activeWorkspaceId }),
      )
    },
    { initialProps: { activeWorkspaceId: workspaceId } },
  )

  expect(result.current).toMatchObject({
    status: 'ready',
    workspaceId: testCampaignId(workspaceId),
  })
  if (result.current.status !== 'ready') throw new Error('expected ready canvas session')
  expect(result.current.nodesMap.has(testCanvasNodeId('workspace-1-node'))).toBe(true)

  rerender({ activeWorkspaceId: secondWorkspaceId })

  expect(result.current).toMatchObject({
    status: 'ready',
    workspaceId: testCampaignId(secondWorkspaceId),
  })
  if (result.current.status !== 'ready') throw new Error('expected ready canvas session')
  expect(result.current.nodesMap.has(testCanvasNodeId('workspace-2-node'))).toBe(true)
})

test('in-memory canvas sessions keep one document when edit capability changes', () => {
  const initialNode = createTextNode('initial-node', 'Initial canvas')
  const addedNode = createTextNode('added-node', 'Added while editable')
  const { result, rerender } = renderHook(
    ({ canEdit }: { canEdit: boolean }) => {
      const source = useInMemoryCanvasSessionSource({
        canEdit,
        getCanvasPayload: () => ({ edges: [], nodes: [initialNode] }),
        user: { name: 'Local', color: '#61afef' },
        workspaceId,
      })
      return source.document.useCanvasDocumentSession(createCanvasItem())
    },
    { initialProps: { canEdit: true } },
  )

  expect(result.current).toMatchObject({ status: 'ready', canEdit: true })
  if (result.current.status !== 'ready') throw new Error('expected ready canvas session')
  const editableSession = result.current

  act(() => {
    editableSession.nodesMap.set(addedNode.id, addedNode)
  })

  rerender({ canEdit: false })

  expect(result.current).toMatchObject({ status: 'ready', canEdit: false })
  if (result.current.status !== 'ready') throw new Error('expected ready canvas session')
  expect(result.current.nodesMap.get(addedNode.id)).toEqual(addedNode)
})

test('in-memory canvas sessions report Yjs document changes as local canvas payload updates', async () => {
  const initialNode = createTextNode('initial-node', 'Initial canvas')
  const addedNode = createTextNode('added-node', 'Persisted canvas edit')
  const onCanvasContentChange = vi.fn()
  const { result } = renderHook(() => {
    const source = useInMemoryCanvasSessionSource({
      canEdit: true,
      getCanvasPayload: () => ({ edges: [], nodes: [initialNode] }),
      onCanvasContentChange,
      user: { name: 'Local', color: '#61afef' },
      workspaceId,
    })
    return source.document.useCanvasDocumentSession(createCanvasItem())
  })

  expect(result.current).toMatchObject({ status: 'ready' })
  if (result.current.status !== 'ready') throw new Error('expected ready canvas session')
  const session = result.current

  act(() => {
    session.nodesMap.set(addedNode.id, addedNode)
  })

  await waitFor(() =>
    expect(onCanvasContentChange).toHaveBeenCalledWith({
      canvasId,
      payload: {
        edges: [],
        nodes: expect.arrayContaining([initialNode, addedNode]),
      },
    }),
  )
})

test('in-memory canvas sessions do not report document changes while read-only', () => {
  const initialNode = createTextNode('initial-node', 'Initial canvas')
  const readOnlyNode = createTextNode('read-only-node', 'Ignored read-only edit')
  const onCanvasContentChange = vi.fn()
  const { result, rerender } = renderHook(
    ({ canEdit }: { canEdit: boolean }) => {
      const source = useInMemoryCanvasSessionSource({
        canEdit,
        getCanvasPayload: () => ({ edges: [], nodes: [initialNode] }),
        onCanvasContentChange,
        user: { name: 'Local', color: '#61afef' },
        workspaceId,
      })
      return source.document.useCanvasDocumentSession(createCanvasItem())
    },
    { initialProps: { canEdit: true } },
  )

  expect(result.current).toMatchObject({ status: 'ready', canEdit: true })

  rerender({ canEdit: false })
  expect(result.current).toMatchObject({ status: 'ready', canEdit: false })
  if (result.current.status !== 'ready') throw new Error('expected ready canvas session')
  const session = result.current
  onCanvasContentChange.mockClear()

  act(() => {
    session.nodesMap.set(readOnlyNode.id, readOnlyNode)
  })

  expect(onCanvasContentChange).not.toHaveBeenCalled()
})

function createCanvasItem({
  workspaceId: itemWorkspaceId = workspaceId,
}: { workspaceId?: string } = {}): LocalCanvasItemWithContent {
  return {
    id: canvasId,
    createdAt: 1,
    allPermissionLevel: null,
    color: null,
    campaignId: testCampaignId(itemWorkspaceId),
    createdBy: 'user-1' as UserProfileId,
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: TEST_RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name: 'Canvas' as LocalCanvasItemWithContent['name'],
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    status: TEST_RESOURCE_STATUS.active,
    type: TEST_RESOURCE_TYPES.canvases,
    updatedBy: null,
    updatedTime: null,
    ancestors: [],
  }
}

type StaticCanvasTestPayload = {
  edges: ReadonlyArray<LocalCanvasDocumentEdge>
  nodes: ReadonlyArray<LocalCanvasDocumentNode>
}

function createTextNode(id: string, text: string): LocalCanvasDocumentNode {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    position: { x: 0, y: 0 },
    width: 120,
    height: 80,
    data: {
      content: [
        {
          id: `${id}-block`,
          type: 'paragraph',
          props: {
            textAlignment: 'left',
            textColor: 'default',
            backgroundColor: 'default',
          },
          content: [{ type: 'text', text, styles: {} }],
          children: [],
        },
      ],
    },
  }
}
