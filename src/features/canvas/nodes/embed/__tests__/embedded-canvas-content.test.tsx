import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbeddedCanvasContent } from '../embedded-canvas-content'
import { testId } from '~/test/helpers/test-id'

const useEmbeddedCanvasStateMock = vi.hoisted(() => vi.fn())
const canvasThumbnailPreviewSpy = vi.hoisted(() => vi.fn())
const canvasPreviewSpy = vi.hoisted(() => vi.fn())

vi.mock('../use-embedded-canvas-state', () => ({
  useEmbeddedCanvasState: (canvasId: string) => useEmbeddedCanvasStateMock(canvasId),
}))

vi.mock('~/features/previews/components/canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: (props: unknown) => {
    canvasThumbnailPreviewSpy(props)
    return <div data-testid="canvas-thumbnail-preview" />
  },
}))

vi.mock('../../../components/canvas-read-only-preview', () => ({
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
      nodes: [],
      edges: [],
      isLoading: true,
      isError: false,
    })

    render(
      <EmbeddedCanvasContent
        nodeId="embed-node-1"
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />,
    )

    expect(screen.getByText('Loading embedded canvas')).toBeInTheDocument()
    expect(screen.queryByTestId('embedded-canvas-preview')).not.toBeInTheDocument()
  })

  it('falls back to the stored canvas thumbnail when the embedded canvas cannot load', () => {
    useEmbeddedCanvasStateMock.mockReturnValue({
      nodes: [],
      edges: [],
      isLoading: false,
      isError: true,
    })

    render(
      <EmbeddedCanvasContent
        nodeId="embed-node-1"
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />,
    )

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
      isLoading: false,
      isError: false,
    })

    render(
      <EmbeddedCanvasContent
        nodeId="embed-node-1"
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />,
    )

    expect(screen.getByTestId('embedded-canvas-preview')).toBeInTheDocument()
    expect(canvasPreviewSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        minZoom: 0.01,
        maxZoom: 4,
        fitPadding: 0.12,
        className: 'pointer-events-none relative h-full w-full min-h-0 min-w-0',
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {}, type: 'text' }],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            sourceHandle: 'right',
            target: 'node-1',
            targetHandle: 'left',
            type: 'bezier',
          },
        ],
      }),
    )
  })

  it('normalizes embedded edges with missing handle ids before rendering the nested canvas preview', () => {
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
      isLoading: false,
      isError: false,
    })
    render(
      <EmbeddedCanvasContent
        nodeId="embed-node-1"
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />,
    )

    expect(canvasPreviewSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: [
          expect.objectContaining({
            id: 'edge-1',
            sourceHandle: 'right',
            targetHandle: 'left',
          }),
        ],
      }),
    )
  })
})

function createCanvasId(value: string) {
  return testId<'sidebarItems'>(value)
}
