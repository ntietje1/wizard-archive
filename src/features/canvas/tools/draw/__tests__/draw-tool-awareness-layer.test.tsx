import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DrawAwarenessLayer } from '../draw-tool-awareness-layer'
import { DrawToolLocalOverlayLayer } from '../draw-tool-local-overlay-layer'
import { clearDrawToolLocalOverlay, setDrawToolLocalDrawing } from '../draw-tool-local-overlay'
import { pointsToPathD } from '../../../nodes/stroke/stroke-node-model'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'
import type { CanvasEngine } from '../../../system/canvas-engine'
import type { ReactNode } from 'react'

function renderWithEngine(ui: ReactNode, engine: CanvasEngine = createCanvasEngine()) {
  return render(<CanvasEngineProvider engine={engine}>{ui}</CanvasEngineProvider>)
}

describe('DrawAwarenessLayer', () => {
  beforeEach(() => {
    clearDrawToolLocalOverlay()
  })

  it('renders remote draw overlays from raw presence', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#f00' },
        presence: {
          'tool.draw': {
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
        selectedNodeIds: null,
      },
    ]

    const { container } = renderWithEngine(<DrawAwarenessLayer remoteUsers={remoteUsers} />)

    expect(container.querySelector('path')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('ignores invalid remote draw awareness payloads', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#f00' },
        presence: {
          'tool.draw': {
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
        selectedNodeIds: null,
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
          'tool.draw': {
            points,
            color: '#f00',
            size: 4,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selectedNodeIds: null,
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
          'tool.draw': {
            points,
            color: '#f00',
            size: 1,
            opacity: 50,
          },
        },
        cursor: null,
        resizing: null,
        selectedNodeIds: null,
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
    setDrawToolLocalDrawing({
      points: [
        [0, 0, 0.5],
        [20, 20, 0.5],
      ],
      color: '#f00',
      size: 4,
      opacity: 50,
    })

    const { container } = renderWithEngine(<DrawToolLocalOverlayLayer />)

    expect(container.querySelector('path')).toBeInTheDocument()
  })

  it('projects local draw overlays into screen space and scales brush size with zoom', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: -5, y: 6, zoom: 2 })
    const points: Array<[number, number, number]> = [
      [0, 0, 0.5],
      [20, 20, 0.5],
    ]
    setDrawToolLocalDrawing({
      points,
      color: '#f00',
      size: 4,
      opacity: 50,
    })

    const { container } = renderWithEngine(<DrawToolLocalOverlayLayer />, engine)

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
    const engine = createCanvasEngine()
    engine.setViewport({ x: 0, y: 0, zoom: 0.25 })
    const points: Array<[number, number, number]> = [
      [0, 0, 0.5],
      [20, 20, 0.5],
    ]
    setDrawToolLocalDrawing({
      points,
      color: '#f00',
      size: 1,
      opacity: 50,
    })

    const { container } = renderWithEngine(<DrawToolLocalOverlayLayer />, engine)

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
