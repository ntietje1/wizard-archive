import { render } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { LassoAwarenessLayer } from '../lasso-tool-awareness-layer'
import { LassoToolLocalOverlayLayer } from '../lasso-tool-local-overlay-layer'
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

describe('Lasso layers', () => {
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
        selection: null,
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
        selection: null,
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

  it('renders the local lasso overlay from the lasso slice store', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setLassoPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ])

    const { container } = renderLocalOverlay(<LassoToolLocalOverlayLayer />, localOverlayStore)

    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
    expect(polygon).toHaveAttribute('points', '0,0 40,0 40,40')
  })

  it('renders a two-point local lasso overlay as an open stroke', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setLassoPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ])

    const { container } = renderLocalOverlay(<LassoToolLocalOverlayLayer />, localOverlayStore)

    const shape = container.querySelector('svg > *')
    expect(shape?.tagName.toLowerCase()).toBe('polyline')
    expect(shape).toHaveAttribute('points', '0,0 40,0')
    expect(shape).toHaveAttribute('fill', 'none')
  })

  it('projects the local lasso overlay into screen space under pan and zoom', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setLassoPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ])

    const { container } = renderLocalOverlay(<LassoToolLocalOverlayLayer />, localOverlayStore, {
      x: -2,
      y: 3,
      zoom: 2,
    })

    const polygon = container.querySelector('polygon')
    expect(polygon).toHaveAttribute('points', '-2,3 78,3 78,83')
    expect(polygon).toHaveAttribute('stroke-width', '1.5')
  })
})
