import type { ResourceId } from '../../resources/domain-id'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../workspace/items-persistence-contract'
import type { ResourceTitle } from '../../resources/resource-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'
import type { CanvasItemWithContent } from '../item-contract'
import { createCanvasDocumentDoc } from '../document-contract'
import { useCanvasDocumentSession } from '../use-document-session'
import type { UserProfileId } from '../../../../../shared/common/ids'
import { testCampaignId } from '../../../../../shared/test/campaign-id'

describe('useCanvasDocumentSession', () => {
  it('returns ready session maps from a loaded collaboration document', () => {
    const node = createNode('node-1')
    const edge = createEdge('edge-1')
    const doc = createCanvasDocumentDoc({ nodes: [node], edges: [edge] })

    const { result } = renderHook(() =>
      useCanvasDocumentSession({
        canvas: createCanvas(),
        canEdit: true,
        collaboration: {
          status: 'ready',
          doc,
          collaboration: { status: 'unsupported' },
        },
        colorMode: 'dark',
        user: { name: 'Mina', color: '#61afef' },
      }),
    )

    expect(result.current).toMatchObject({
      status: 'ready',
      canvasId: 'canvas-1',
      workspaceId: testCampaignId('campaign-1'),
      canEdit: true,
      colorMode: 'dark',
      parentId: 'folder-1',
      user: { name: 'Mina', color: '#61afef' },
      collaboration: { status: 'unsupported' },
    })
    if (result.current.status !== 'ready') throw new Error('expected ready session')
    expect(result.current.nodesMap.get(testCanvasNodeId('node-1'))).toEqual(node)
    expect(result.current.edgesMap.get('edge-1')).toEqual(edge)
    doc.destroy()
  })

  it('reports loading and error states before the canvas document is ready', () => {
    const canvas = createCanvas()
    const loading = renderHook(() =>
      useCanvasDocumentSession({
        canvas,
        canEdit: false,
        collaboration: { status: 'loading' },
        colorMode: 'light',
        user: { name: 'Mina', color: '#61afef' },
      }),
    )

    expect(loading.result.current).toEqual({ status: 'loading' })

    const failure = new Error('connection lost')
    const errored = renderHook(() =>
      useCanvasDocumentSession({
        canvas,
        canEdit: false,
        collaboration: { status: 'error', error: failure },
        colorMode: 'light',
        user: { name: 'Mina', color: '#61afef' },
      }),
    )

    expect(errored.result.current).toEqual({ status: 'error', error: failure })

    const nonErrorFailure = { code: 'provider_failed', detail: 'token expired' }
    const nonError = renderHook(() =>
      useCanvasDocumentSession({
        canvas,
        canEdit: false,
        collaboration: { status: 'error', error: nonErrorFailure },
        colorMode: 'light',
        user: { name: 'Mina', color: '#61afef' },
      }),
    )

    expect(nonError.result.current).toEqual({ status: 'error', error: nonErrorFailure })

    const falsyError = renderHook(() =>
      useCanvasDocumentSession({
        canvas,
        canEdit: false,
        collaboration: { status: 'error', error: '' },
        colorMode: 'light',
        user: { name: 'Mina', color: '#61afef' },
      }),
    )

    expect(falsyError.result.current).toEqual({ status: 'error', error: '' })
  })

  it('keeps the ready session identity stable while inputs are unchanged', () => {
    const doc = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const canvas = createCanvas()
    const user = { name: 'Mina', color: '#61afef' }
    const { result, rerender } = renderHook(
      ({ canEdit, colorMode }: { canEdit: boolean; colorMode: 'light' | 'dark' }) =>
        useCanvasDocumentSession({
          canvas,
          canEdit,
          collaboration: {
            status: 'ready',
            doc,
            collaboration: { status: 'unsupported' },
          },
          colorMode,
          user,
        }),
      { initialProps: { canEdit: true, colorMode: 'dark' } },
    )

    const initialSession = result.current
    rerender({ canEdit: true, colorMode: 'dark' })

    expect(result.current).toBe(initialSession)

    rerender({ canEdit: false, colorMode: 'dark' })

    expect(result.current).not.toBe(initialSession)
    doc.destroy()
  })
})

function createCanvas(overrides: Partial<CanvasItemWithContent> = {}): CanvasItemWithContent {
  return {
    id: 'canvas-1' as ResourceId,
    createdAt: 1,
    type: RESOURCE_TYPES.canvases,
    campaignId: testCampaignId('campaign-1'),
    name: 'Canvas' as ResourceTitle,
    parentId: 'folder-1' as ResourceId,
    iconName: null,
    color: null,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user-1' as UserProfileId,
    deletionTime: null,
    deletedBy: null,
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    isActive: true,
    isTrashed: false,
    ancestors: [],
    shares: [],
    ...overrides,
  }
}

function createNode(id: string): CanvasDocumentNode {
  return {
    id: testCanvasNodeId(id),
    type: 'text',
    position: { x: 0, y: 0 },
    data: { content: [] },
    width: 100,
    height: 80,
  }
}

function createEdge(id: string): CanvasDocumentEdge {
  return {
    id,
    source: testCanvasNodeId('node-1'),
    target: testCanvasNodeId('node-2'),
    type: 'step',
  }
}
