import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LassoAwarenessLayer } from '../lasso-tool-awareness-layer'
import { LassoToolLocalOverlayLayer } from '../lasso-tool-local-overlay-layer'
import { clearLassoToolLocalOverlay, setLassoToolLocalPoints } from '../lasso-tool-local-overlay'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'
import type { CanvasEngine } from '../../../system/canvas-engine'
import type { ReactNode } from 'react'

function renderWithEngine(ui: ReactNode, engine: CanvasEngine = createCanvasEngine()) {
  return render(<CanvasEngineProvider engine={engine}>{ui}</CanvasEngineProvider>)
}

describe('Lasso layers', () => {
  beforeEach(() => {
    clearLassoToolLocalOverlay()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders remote lasso overlays from raw presence', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#0f0' },
        presence: {
          'tool.lasso': {
            type: 'lasso',
            points: [
              { x: 0, y: 0 },
              { x: 40, y: 0 },
              { x: 40, y: 40 },
            ],
          },
        },
        cursor: null,
        resizing: null,
        selectedNodeIds: null,
      },
    ]

    const { container } = renderWithEngine(<LassoAwarenessLayer remoteUsers={remoteUsers} />)

    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
    expect(polygon).toHaveAttribute('points', '0,0 40,0 40,40')
    expect(polygon).toHaveAttribute('fill', '#0f0')
  })

  it('projects remote lasso overlays into screen space under pan and zoom', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: 5, y: -10, zoom: 2 })
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#0f0' },
        presence: {
          'tool.lasso': {
            type: 'lasso',
            points: [
              { x: 0, y: 0 },
              { x: 40, y: 0 },
              { x: 40, y: 40 },
            ],
          },
        },
        cursor: null,
        resizing: null,
        selectedNodeIds: null,
      },
    ]

    const { container } = renderWithEngine(
      <LassoAwarenessLayer remoteUsers={remoteUsers} />,
      engine,
    )

    const polygon = container.querySelector('polygon')
    expect(polygon).toHaveAttribute('points', '5,-10 85,-10 85,70')
    expect(polygon).toHaveAttribute('stroke-width', '1.5')
  })

  it.each([
    { label: 'missing x', points: [{ y: 0 }] },
    { label: 'empty point', points: [{}] },
    { label: 'null point entry', points: [null] },
    { label: 'undefined point entry', points: [undefined] },
    { label: 'invalid x type', points: [{ x: 'invalid', y: 0 }] },
    { label: 'empty point list', points: [] },
    { label: 'too few points', points: [{ x: 0, y: 0 }] },
    { label: 'null points', points: null },
    { label: 'undefined points', points: undefined },
  ])(
    'ignores invalid remote lasso awareness payloads without logging errors: $label',
    ({ points }) => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const remoteUsers: Array<RemoteUser> = [
        {
          clientId: 1,
          user: { name: 'Tester', color: '#0f0' },
          presence: {
            'tool.lasso': {
              type: 'lasso',
              points,
            },
          },
          cursor: null,
          resizing: null,
          selectedNodeIds: null,
        },
      ]

      const { container } = renderWithEngine(<LassoAwarenessLayer remoteUsers={remoteUsers} />)

      expect(container.querySelector('polygon')).not.toBeInTheDocument()
      expect(container.querySelector('polyline')).not.toBeInTheDocument()
      expect(errorSpy).not.toHaveBeenCalled()
    },
  )

  it('renders the local lasso overlay from the lasso slice store', () => {
    setLassoToolLocalPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ])

    const { container } = renderWithEngine(<LassoToolLocalOverlayLayer />)

    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
    expect(polygon).toHaveAttribute('points', '0,0 40,0 40,40')
  })

  it('projects the local lasso overlay into screen space under pan and zoom', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: -2, y: 3, zoom: 2 })
    setLassoToolLocalPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ])

    const { container } = renderWithEngine(<LassoToolLocalOverlayLayer />, engine)

    const polygon = container.querySelector('polygon')
    expect(polygon).toHaveAttribute('points', '-2,3 78,3 78,83')
    expect(polygon).toHaveAttribute('stroke-width', '1.5')
  })
})
