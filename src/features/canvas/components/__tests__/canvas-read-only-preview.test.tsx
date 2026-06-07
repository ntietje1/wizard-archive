import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasReadOnlyPreview } from '../canvas-read-only-preview'
import { normalizeEmbedNodeData } from '../../nodes/embed/embed-node-data'
import { testId } from '~/test/helpers/test-id'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasNodeComponentProps } from '../../nodes/canvas-node-types'
import type { EmbedNodeData } from '../../nodes/embed/embed-node-data'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

const resizeObservers: Array<MockResizeObserver> = []
let animationFrameCallbacks: Array<FrameRequestCallback> = []

describe('CanvasReadOnlyPreview', () => {
  beforeEach(() => {
    resizeObservers.length = 0
    animationFrameCallbacks = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback)
      return animationFrameCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      if (Number.isFinite(handle) && handle >= 1 && handle <= animationFrameCallbacks.length) {
        animationFrameCallbacks[handle - 1] = () => undefined
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('applies embed text color to read-only preview nodes', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            width: 240,
            height: 180,
            data: {
              target: {
                kind: 'sidebarItem',
                sidebarItemId: testId<'sidebarItems'>('note-1'),
              },
              textColor: 'var(--t-purple)',
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
      />,
    )

    const previewEl = await screen.findByText('Embedded item preview unavailable.')

    await waitFor(() => {
      expect(previewEl).toHaveStyle({
        color: 'var(--t-purple)',
      })
    })
  })

  it('uses an injected embed renderer for read-only embedded nodes', async () => {
    render(
      <CanvasReadOnlyPreview
        sourceItemId={testId<'sidebarItems'>('canvas-1')}
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            width: 240,
            height: 180,
            data: {
              target: {
                kind: 'sidebarItem',
                sidebarItemId: testId<'sidebarItems'>('note-1'),
              },
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
        embedRenderer={InjectedEmbedRenderer}
      />,
    )

    expect(await screen.findByTestId('injected-embed-renderer')).toHaveTextContent('note-1')
    expect(screen.getByTestId('injected-source-item')).toHaveTextContent('canvas-1')
    expect(screen.queryByText('Embedded item preview unavailable.')).not.toBeInTheDocument()
  })

  it('renders non-interactive preview nodes and edges without pointer targeting', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          createTextNode({ id: 'node-1', position: { x: 0, y: 0 } }),
          createTextNode({ id: 'node-2', position: { x: 200, y: 0 } }),
        ]}
        edges={[createEdge({ id: 'edge-1', source: 'node-1', target: 'node-2' })]}
      />,
    )

    const nodeShells = await screen.findAllByLabelText('text node')
    expect(nodeShells[0]).toHaveStyle({
      pointerEvents: 'none',
    })
    expect(document.querySelector('[data-canvas-edge-id="edge-1"]')).toHaveClass(
      'pointer-events-none',
    )
  })

  it('drops invalid preview records before seeding the preview engine', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          createTextNode({ id: 'node-1', position: { x: 0, y: 0 } }),
          {
            id: 'invalid-node',
            type: 'unknown',
            position: { x: 100, y: 0 },
            width: 100,
            height: 80,
            data: {},
          } as unknown as CanvasDocumentNode,
        ]}
        edges={[
          createEdge({ id: 'edge-1', source: 'node-1', target: 'node-1' }),
          {
            id: 'invalid-edge',
            source: 'node-1',
            target: 'node-1',
            type: 'curved',
          } as unknown as CanvasDocumentEdge,
        ]}
      />,
    )

    expect(await screen.findAllByLabelText('text node')).toHaveLength(1)
    expect(document.querySelector('[data-canvas-edge-id="edge-1"]')).toBeInTheDocument()
    expect(document.querySelector('[data-canvas-edge-id="invalid-edge"]')).not.toBeInTheDocument()
  })

  it('keeps explicitly interactive preview nodes and edges targetable', async () => {
    render(
      <CanvasReadOnlyPreview
        interactive
        nodes={[
          createTextNode({ id: 'node-1', position: { x: 0, y: 0 } }),
          createTextNode({ id: 'node-2', position: { x: 200, y: 0 } }),
        ]}
        edges={[createEdge({ id: 'edge-1', source: 'node-1', target: 'node-2' })]}
      />,
    )

    const nodeShells = await screen.findAllByLabelText('text node')
    expect(nodeShells[0]).toHaveStyle({
      pointerEvents: 'auto',
    })
    expect(document.querySelector('[data-canvas-edge-id="edge-1"]')).toHaveClass(
      'pointer-events-auto',
    )
  })

  it('fits using untransformed ResizeObserver size when a parent canvas is zoomed', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            width: 100,
            height: 100,
            data: {
              target: {
                kind: 'sidebarItem',
                sidebarItemId: testId<'sidebarItems'>('note-1'),
              },
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
        fitPadding={0}
      />,
    )

    const surface = screen.getByTestId('canvas-read-only-preview')
    const viewport = surface.querySelector<HTMLElement>('[data-canvas-viewport="true"]')
    expect(viewport).not.toBeNull()
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ width: 200, height: 150 }),
    )

    act(() => {
      emitResize(surface, { width: 400, height: 300 })
      flushAnimationFrame()
    })

    await waitFor(() => {
      expect(viewport).toHaveStyle({
        transform: 'translate3d(50px, 0px, 0) scale(3)',
      })
    })
  })

  it('fits from validated preview nodes during initial layout', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === 'canvas-read-only-preview'
          ? createDomRect({ width: 400, height: 300 })
          : createDomRect({ width: 0, height: 0 })
      },
    )

    render(
      <CanvasReadOnlyPreview
        nodes={[createTextNode({ id: 'node-1', position: { x: 0, y: 0 } })]}
        edges={[]}
        fitPadding={0}
      />,
    )

    const surface = screen.getByTestId('canvas-read-only-preview')
    const viewport = surface.querySelector<HTMLElement>('[data-canvas-viewport="true"]')
    expect(viewport).not.toBeNull()

    await waitFor(() => {
      expect(viewport).toHaveStyle({
        transform: 'translate3d(12.5px, 0px, 0) scale(3.75)',
      })
    })
  })

  it('scales and pans the preview background from the fitted embedded viewport', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            width: 100,
            height: 100,
            data: {
              target: {
                kind: 'sidebarItem',
                sidebarItemId: testId<'sidebarItems'>('note-1'),
              },
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
        fitPadding={0}
      />,
    )

    const surface = screen.getByTestId('canvas-read-only-preview')
    const background = screen.getByTestId('canvas-read-only-preview-background')

    act(() => {
      emitResize(surface, { width: 400, height: 300 })
      flushAnimationFrame()
    })

    await waitFor(() => {
      expect(background).toHaveStyle({
        backgroundPosition: '50px 0px',
        backgroundSize: '62.354px 62.354px',
      })
    })
  })

  it('reproduces clipping when embedded canvas nodes only have measured dimensions', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            data: {
              target: {
                kind: 'sidebarItem',
                sidebarItemId: testId<'sidebarItems'>('note-1'),
              },
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
        fitPadding={0}
      />,
    )

    const surface = screen.getByTestId('canvas-read-only-preview')
    const viewport = surface.querySelector<HTMLElement>('[data-canvas-viewport="true"]')
    expect(viewport).not.toBeNull()

    const nodeShell = await screen.findByLabelText('embed node')

    act(() => {
      emitResize(surface, { width: 100, height: 80 })
      emitResize(nodeShell, { width: 400, height: 320 })
      flushAnimationFrame()
    })

    await waitFor(() => {
      expect(viewport).toHaveStyle({
        transform: 'translate3d(0px, 0px, 0) scale(0.25)',
      })
    })
  })

  it('reproduces clipping when fitting requires zoom below the interactive viewport minimum', async () => {
    render(
      <CanvasReadOnlyPreview
        nodes={[
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            width: 4000,
            height: 3200,
            data: {
              target: {
                kind: 'sidebarItem',
                sidebarItemId: testId<'sidebarItems'>('note-1'),
              },
            },
          } satisfies CanvasDocumentNode,
        ]}
        edges={[]}
        fitPadding={0}
        minZoom={0.01}
      />,
    )

    const surface = screen.getByTestId('canvas-read-only-preview')
    const viewport = surface.querySelector<HTMLElement>('[data-canvas-viewport="true"]')
    expect(viewport).not.toBeNull()

    act(() => {
      emitResize(surface, { width: 100, height: 80 })
      flushAnimationFrame()
    })

    await waitFor(() => {
      expect(viewport).toHaveStyle({
        transform: 'translate3d(0px, 0px, 0) scale(0.025)',
      })
    })
  })
})

function InjectedEmbedRenderer({
  data,
  sourceItemId,
}: CanvasNodeComponentProps<EmbedNodeData> & {
  sourceItemId?: Id<'sidebarItems'> | null
}) {
  const target = normalizeEmbedNodeData(data).target
  return (
    <>
      <div data-testid="injected-embed-renderer">
        {target.kind === 'sidebarItem' ? target.sidebarItemId : target.kind}
      </div>
      <div data-testid="injected-source-item">{sourceItemId}</div>
    </>
  )
}

class MockResizeObserver implements ResizeObserver {
  readonly elements = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this)
  }

  observe = (target: Element) => {
    this.elements.add(target)
  }

  unobserve = (target: Element) => {
    this.elements.delete(target)
  }

  disconnect = () => {
    this.elements.clear()
  }

  takeRecords = () => []

  emit(target: Element, size: { width: number; height: number }) {
    this.callback([createResizeObserverEntry(target, size)], this)
  }
}

function createTextNode({
  id,
  position,
}: {
  id: string
  position: { x: number; y: number }
}): CanvasDocumentNode {
  return {
    id,
    type: 'text',
    position,
    width: 100,
    height: 80,
    data: {},
  } satisfies CanvasDocumentNode
}

function createEdge({
  id,
  source,
  target,
}: {
  id: string
  source: string
  target: string
}): CanvasDocumentEdge {
  return {
    id,
    source,
    target,
    sourceHandle: null,
    targetHandle: null,
    type: 'straight',
    style: {},
  } satisfies CanvasDocumentEdge
}

function emitResize(target: Element, size: { width: number; height: number }) {
  const observer = resizeObservers.find((candidate) => candidate.elements.has(target))
  expect(observer).toBeDefined()
  observer?.emit(target, size)
}

function flushAnimationFrame() {
  const callbacks = animationFrameCallbacks
  animationFrameCallbacks = []
  for (const callback of callbacks) {
    callback(0)
  }
}

function createResizeObserverEntry(
  target: Element,
  { width, height }: { width: number; height: number },
): ResizeObserverEntry {
  return {
    target,
    contentRect: createDomRect({ width, height }),
    borderBoxSize: [{ inlineSize: width, blockSize: height }] as Array<ResizeObserverSize>,
    contentBoxSize: [{ inlineSize: width, blockSize: height }] as Array<ResizeObserverSize>,
    devicePixelContentBoxSize: [
      { inlineSize: width, blockSize: height },
    ] as Array<ResizeObserverSize>,
  }
}

function createDomRect({ width, height }: { width: number; height: number }): DOMRectReadOnly {
  return {
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}
