import { render } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { DrawAwarenessLayer } from '../draw-tool-awareness-layer'
import { DRAW_TOOL_AWARENESS_NAMESPACE } from '../draw-tool-awareness-namespace'
import { DrawToolLocalOverlayLayer } from '../draw-tool-local-overlay-layer'
import { pointsToPathD } from '../../../nodes/stroke/stroke-node-model'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasViewport } from '../../../types/canvas-domain-types'
import type { ReactNode } from 'react'

function renderWithEngine(ui: ReactNode, engine: CanvasEngine = createCanvasEngine()) {
  return render(<CanvasEngineProvider engine={engine}>{ui}</CanvasEngineProvider>)
}

function renderLocalOverlay(
  ui: ReactNode,
  localOverlayStore = createCanvasToolLocalOverlayStore(),
  viewport?: CanvasViewport,
) {
  const runtime = createCanvasRuntime({ canEdit: false })
  if (viewport) {
    runtime.canvasEngine.setViewport(viewport)
  }

  return render(
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRuntimeProvider {...runtime} localOverlayStore={localOverlayStore}>
        {ui}
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )
}

describe('DrawAwarenessLayer', () => {
  it('renders remote draw overlays from raw presence', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#f00' },
        presence: {
          [DRAW_TOOL_AWARENESS_NAMESPACE]: {
            points: [
              [0, 0, 0.5],
              [20, 20, 0.5],
            ],
            color: '#f00',
            size: 4,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<DrawAwarenessLayer remoteUsers={remoteUsers} />)

    const path = container.querySelector('[data-testid="canvas-remote-draw-preview"]')
    expect(path).toBeInTheDocument()
    expect(path).toHaveAttribute('fill', '#f00')
    expect(path).toHaveAttribute('opacity', '0.35')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('skips remote draw overlays without drawable points', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Idle tester', color: '#f00' },
        presence: {},
        cursor: null,
        resizing: null,
        selection: null,
      },
      {
        clientId: 2,
        user: { name: 'Single point tester', color: '#0f0' },
        presence: {
          [DRAW_TOOL_AWARENESS_NAMESPACE]: {
            points: [[0, 0, 0.5]],
            color: '#0f0',
            size: 4,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<DrawAwarenessLayer remoteUsers={remoteUsers} />)

    expect(container.querySelector('[data-testid="canvas-remote-draw-preview"]')).toBeNull()
  })

  it('ignores invalid remote draw awareness payloads', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#f00' },
        presence: {
          [DRAW_TOOL_AWARENESS_NAMESPACE]: {
            points: [
              [0, 0, 0.5],
              [1, 1, 'bad'],
            ],
            color: '#f00',
            size: 4,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<DrawAwarenessLayer remoteUsers={remoteUsers} />)

    expect(container.querySelector('path')).not.toBeInTheDocument()
  })

  it('projects remote draw overlays into screen space and scales brush size with zoom', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: 5, y: -10, zoom: 2 })
    const points: Array<[number, number, number]> = [
      [0, 0, 0.5],
      [20, 20, 0.5],
    ]
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#f00' },
        presence: {
          [DRAW_TOOL_AWARENESS_NAMESPACE]: {
            points,
            color: '#f00',
            size: 4,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<DrawAwarenessLayer remoteUsers={remoteUsers} />, engine)

    expect(container.querySelector('path')).toHaveAttribute(
      'd',
      pointsToPathD(
        [
          [5, -10, 0.5],
          [45, 30, 0.5],
        ],
        8,
      ),
    )
  })

  it('floors remote draw preview strokes to one screen pixel when zoomed out', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: 0, y: 0, zoom: 0.25 })
    const points: Array<[number, number, number]> = [
      [0, 0, 0.5],
      [20, 20, 0.5],
    ]
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#f00' },
        presence: {
          [DRAW_TOOL_AWARENESS_NAMESPACE]: {
            points,
            color: '#f00',
            size: 1,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<DrawAwarenessLayer remoteUsers={remoteUsers} />, engine)

    expect(container.querySelector('path')).toHaveAttribute(
      'd',
      pointsToPathD(
        [
          [0, 0, 0.5],
          [5, 5, 0.5],
        ],
        1,
      ),
    )
  })

  it('renders the local draw overlay from the draw slice store', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setDrawLocalDrawing({
      points: [
        [0, 0, 0.5],
        [20, 20, 0.5],
      ],
      color: '#f00',
      size: 4,
      opacity: 50,
    })

    const { container } = renderLocalOverlay(<DrawToolLocalOverlayLayer />, localOverlayStore)

    expect(container.querySelector('path')).toBeInTheDocument()
  })

  it('projects local draw overlays into screen space and scales brush size with zoom', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    const points: Array<[number, number, number]> = [
      [0, 0, 0.5],
      [20, 20, 0.5],
    ]
    localOverlayStore.getState().setDrawLocalDrawing({
      points,
      color: '#f00',
      size: 4,
      opacity: 50,
    })

    const { container } = renderLocalOverlay(<DrawToolLocalOverlayLayer />, localOverlayStore, {
      x: -5,
      y: 6,
      zoom: 2,
    })

    expect(container.querySelector('path')).toHaveAttribute(
      'd',
      pointsToPathD(
        [
          [-5, 6, 0.5],
          [35, 46, 0.5],
        ],
        8,
      ),
    )
  })

  it('floors local draw preview strokes to one screen pixel when zoomed out', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    const points: Array<[number, number, number]> = [
      [0, 0, 0.5],
      [20, 20, 0.5],
    ]
    localOverlayStore.getState().setDrawLocalDrawing({
      points,
      color: '#f00',
      size: 1,
      opacity: 50,
    })

    const { container } = renderLocalOverlay(<DrawToolLocalOverlayLayer />, localOverlayStore, {
      x: 0,
      y: 0,
      zoom: 0.25,
    })

    expect(container.querySelector('path')).toHaveAttribute(
      'd',
      pointsToPathD(
        [
          [0, 0, 0.5],
          [5, 5, 0.5],
        ],
        1,
      ),
    )
  })
})
