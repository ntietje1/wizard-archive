import type { ResourceId } from '../../../resources/domain-id'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { EmbeddedCanvasContent } from '../embedded-canvas-content'
import { EmbeddedCanvasStateProvider } from '../../../canvas/embedded-canvas-state-context'
import type { EmbeddedCanvasStateSource } from '../../../canvas/embedded-canvas-state-context'

const useEmbeddedCanvasStateMock = vi.hoisted(() => vi.fn())
const canvasThumbnailPreviewSpy = vi.hoisted(() => vi.fn())
const canvasPreviewSpy = vi.hoisted(() => vi.fn())

vi.mock('../../../canvas/preview/canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: (props: unknown) => {
    canvasThumbnailPreviewSpy(props)
    return <div data-testid="canvas-thumbnail-preview" />
  },
}))

vi.mock('../../../canvas/preview/read-only-preview', () => ({
  CanvasReadOnlyPreview: (props: Record<string, unknown>) => {
    canvasPreviewSpy(props)
    return <div data-testid="embedded-canvas-preview" />
  },
}))

describe('EmbeddedCanvasContent', () => {
  beforeEach(() => {
    canvasThumbnailPreviewSpy.mockReset()
    canvasPreviewSpy.mockReset()
  })

  it('shows a loading state while embedded canvas data is loading', () => {
    useEmbeddedCanvasStateMock.mockReturnValue({
      status: 'loading',
    })

    renderEmbeddedCanvasContent()

    expect(screen.getByText('Loading embedded canvas')).toBeInTheDocument()
  })

  it('falls back to the stored canvas thumbnail when the embedded canvas cannot load', () => {
    useEmbeddedCanvasStateMock.mockReturnValue({
      status: 'unavailable',
    })

    renderEmbeddedCanvasContent()

    expect(screen.getByTestId('canvas-thumbnail-preview')).toBeInTheDocument()
    expect(canvasThumbnailPreviewSpy).toHaveBeenCalledWith({
      previewUrl: 'canvas.png',
      alt: 'Canvas',
    })
  })

  it('renders a read-only nested canvas preview with passive pointer handling and zoom bounds', () => {
    useEmbeddedCanvasStateMock.mockReturnValue({
      nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {}, type: 'text' }],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-1', type: 'bezier' }],
      status: 'available',
    })

    renderEmbeddedCanvasContent()

    expect(screen.getByTestId('embedded-canvas-preview')).toBeInTheDocument()
    expect(canvasPreviewSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minZoom: 0.01,
        maxZoom: 4,
        fitPadding: 0.12,
        className: expect.stringContaining('pointer-events-none'),
        sourceItemId: createCanvasId('canvas-1'),
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {}, type: 'text' }],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-1', type: 'bezier' }],
      }),
    )
  })

  it('passes embedded edges through to the nested canvas preview', () => {
    useEmbeddedCanvasStateMock.mockReturnValue({
      nodes: [
        {
          id: 'source-node',
          position: { x: 0, y: 0 },
          width: 100,
          height: 80,
          data: {},
          type: 'text',
        },
        {
          id: 'target-node',
          position: { x: 300, y: 0 },
          width: 100,
          height: 80,
          data: {},
          type: 'text',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'source-node',
          target: 'target-node',
          sourceHandle: null,
          targetHandle: null,
          type: 'bezier',
        },
      ],
      status: 'available',
    })
    renderEmbeddedCanvasContent()

    expect(canvasPreviewSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: [
          {
            id: 'edge-1',
            source: 'source-node',
            target: 'target-node',
            sourceHandle: null,
            targetHandle: null,
            type: 'bezier',
          },
        ],
      }),
    )
  })
})

const testEmbeddedCanvasStateSource: EmbeddedCanvasStateSource = {
  useEmbeddedCanvasState: (canvasId) => useEmbeddedCanvasStateMock(canvasId),
}

function renderEmbeddedCanvasContent() {
  return render(
    <EmbeddedCanvasStateProvider source={testEmbeddedCanvasStateSource}>
      <EmbeddedCanvasContent
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />
    </EmbeddedCanvasStateProvider>,
  )
}

function createCanvasId(value: string) {
  return value as ResourceId
}
