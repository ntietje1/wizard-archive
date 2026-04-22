import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbeddedCanvasContent } from '../embedded-canvas-content'
import { testId } from '~/test/helpers/test-id'

const useEmbeddedCanvasStateMock = vi.hoisted(() => vi.fn())
const canvasThumbnailPreviewSpy = vi.hoisted(() => vi.fn())
const reactFlowSpy = vi.hoisted(() => vi.fn())
const getNodesBoundsMock = vi.hoisted(() => vi.fn())
const getViewportForBoundsMock = vi.hoisted(() => vi.fn())
const reactFlowStoreSetStateMock = vi.hoisted(() => vi.fn())

vi.mock('../use-embedded-canvas-state', () => ({
  useEmbeddedCanvasState: (canvasId: string) => useEmbeddedCanvasStateMock(canvasId),
}))

vi.mock('../../runtime/providers/canvas-read-only-providers', () => ({
  CanvasReadOnlyProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../edges/canvas-edge-registry', () => ({
  canvasEdgeTypes: {},
}))

vi.mock('../embedded-canvas-node-types', () => ({
  getEmbeddedCanvasNodeTypes: () => ({}),
}))

vi.mock('~/features/settings/hooks/useTheme', () => ({
  useResolvedTheme: () => 'dark',
}))

vi.mock('~/features/previews/components/canvas-thumbnail-preview', () => ({
  CanvasThumbnailPreview: (props: unknown) => {
    canvasThumbnailPreviewSpy(props)
    return <div data-testid="canvas-thumbnail-preview" />
  },
}))

vi.mock('@xyflow/react', () => ({
  Background: () => <div data-testid="embedded-canvas-background" />,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ReactFlow: (props: Record<string, unknown>) => {
    reactFlowSpy(props)
    return <div data-testid="embedded-react-flow">{props.children as React.ReactNode}</div>
  },
  getNodesBounds: (nodes: unknown) => getNodesBoundsMock(nodes),
  getViewportForBounds: (...args: Array<unknown>) => getViewportForBoundsMock(...args),
  useInternalNode: () => ({
    width: 400,
    height: 240,
    measured: { width: 400, height: 240 },
  }),
  useStoreApi: () => ({
    getState: () => ({ width: 0, height: 0 }),
    setState: reactFlowStoreSetStateMock,
  }),
}))

describe('EmbeddedCanvasContent', () => {
  beforeEach(() => {
    reactFlowSpy.mockReset()
    canvasThumbnailPreviewSpy.mockReset()
    getNodesBoundsMock.mockReset()
    getViewportForBoundsMock.mockReset()
    reactFlowStoreSetStateMock.mockReset()
    getNodesBoundsMock.mockReturnValue({ x: 10, y: 20, width: 100, height: 50 })
    getViewportForBoundsMock.mockReturnValue({ x: -5, y: -10, zoom: 0.75 })
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
    expect(screen.queryByTestId('embedded-react-flow')).toBeNull()
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

  it('renders a read-only nested React Flow canvas, keeps nested pan and zoom disabled, and derives viewport from the embed size', async () => {
    useEmbeddedCanvasStateMock.mockReturnValue({
      nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {}, type: 'text' }],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-1', type: 'bezier' }],
      isLoading: false,
      isError: false,
    })

    const { container } = render(
      <EmbeddedCanvasContent
        nodeId="embed-node-1"
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />,
    )

    expect(screen.getByTestId('embedded-react-flow')).toBeInTheDocument()
    expect(reactFlowSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        colorMode: 'dark',
        zoomOnScroll: false,
        zoomOnPinch: false,
        panOnDrag: false,
        panOnScroll: false,
        nodesDraggable: false,
        nodesConnectable: false,
        elementsSelectable: false,
        viewport: { x: -5, y: -10, zoom: 0.75 },
      }),
    )
    expect(container.firstChild).not.toHaveClass('nowheel')

    await waitFor(() => {
      expect(getNodesBoundsMock).toHaveBeenCalledWith([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {}, type: 'text' },
      ])
      expect(getViewportForBoundsMock).toHaveBeenCalledWith(
        { x: 10, y: 20, width: 100, height: 50 },
        400,
        240,
        0.01,
        4,
        0.12,
      )
      expect(reactFlowStoreSetStateMock).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  it('normalizes embedded edges with missing handle ids before rendering the nested flow', () => {
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
    getNodesBoundsMock.mockImplementation(
      (nodes: Array<{ position: { x: number; y: number }; width?: number; height?: number }>) => {
        if (nodes.length === 1) {
          const [node] = nodes
          return {
            x: node.position.x,
            y: node.position.y,
            width: node.width ?? 0,
            height: node.height ?? 0,
          }
        }

        return { x: 0, y: 0, width: 400, height: 80 }
      },
    )

    render(
      <EmbeddedCanvasContent
        nodeId="embed-node-1"
        canvasId={createCanvasId('canvas-1')}
        previewUrl="canvas.png"
        alt="Canvas"
      />,
    )

    expect(reactFlowSpy).toHaveBeenLastCalledWith(
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
