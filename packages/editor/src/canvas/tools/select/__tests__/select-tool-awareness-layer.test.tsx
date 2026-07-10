import { render } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { SelectAwarenessLayer } from '../select-tool-awareness-layer'
import { SelectToolLocalOverlayLayer } from '../select-tool-local-overlay-layer'
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

describe('SelectAwarenessLayer', () => {
  it('ignores remote users without a valid marquee awareness payload', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Idle tester', color: '#00f' },
        presence: {},
        cursor: null,
        resizing: null,
        selection: null,
      },
      {
        clientId: 2,
        user: { name: 'Legacy tester', color: '#0f0' },
        presence: {
          'tool.select': {
            type: 'rect',
            x: 10,
            y: 20,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<SelectAwarenessLayer remoteUsers={remoteUsers} />)

    expect(container.querySelector('rect')).not.toBeInTheDocument()
  })

  it('renders remote marquee overlays from raw presence', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#00f' },
        presence: {
          'tool.select': {
            type: 'rect',
            x: 10,
            y: 20,
            width: 30,
            height: 40,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(<SelectAwarenessLayer remoteUsers={remoteUsers} />)

    const rect = container.querySelector('rect')
    expect(rect).toBeInTheDocument()
    expect(rect).toHaveAttribute('x', '10')
    expect(rect).toHaveAttribute('y', '20')
    expect(rect).toHaveAttribute('width', '30')
    expect(rect).toHaveAttribute('height', '40')
    expect(rect).toHaveAttribute('fill', '#00f')
  })

  it('assigns remote marquee previews a unique test id per user', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'One', color: '#00f' },
        presence: {
          'tool.select': {
            type: 'rect',
            x: 10,
            y: 20,
            width: 30,
            height: 40,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
      {
        clientId: 2,
        user: { name: 'Two', color: '#0f0' },
        presence: {
          'tool.select': {
            type: 'rect',
            x: 50,
            y: 60,
            width: 70,
            height: 80,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { getByTestId } = renderWithEngine(<SelectAwarenessLayer remoteUsers={remoteUsers} />)

    expect(getByTestId('canvas-remote-selection-preview-1')).toHaveAttribute('fill', '#00f')
    expect(getByTestId('canvas-remote-selection-preview-2')).toHaveAttribute('fill', '#0f0')
  })

  it('projects remote marquee overlays into screen space under pan and zoom', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: 5, y: 7, zoom: 2 })
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Tester', color: '#00f' },
        presence: {
          'tool.select': {
            type: 'rect',
            x: 10,
            y: 20,
            width: 30,
            height: 40,
          },
        },
        cursor: null,
        resizing: null,
        selection: null,
      },
    ]

    const { container } = renderWithEngine(
      <SelectAwarenessLayer remoteUsers={remoteUsers} />,
      engine,
    )

    const rect = container.querySelector('rect')
    expect(rect).toHaveAttribute('x', '25')
    expect(rect).toHaveAttribute('y', '47')
    expect(rect).toHaveAttribute('width', '60')
    expect(rect).toHaveAttribute('height', '80')
    expect(rect).toHaveAttribute('stroke-width', '1.5')
  })
})

describe('SelectToolLocalOverlayLayer', () => {
  it('renders the local marquee overlay from the select slice store', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setSelectSelectionDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = renderLocalOverlay(<SelectToolLocalOverlayLayer />, localOverlayStore)

    const rect = container.querySelector('rect')
    expect(rect).toBeInTheDocument()
    expect(rect).toHaveAttribute('x', '10')
    expect(rect).toHaveAttribute('y', '20')
    expect(rect).toHaveAttribute('width', '30')
    expect(rect).toHaveAttribute('height', '40')
  })

  it('projects the local marquee overlay into screen space under pan and zoom', () => {
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    localOverlayStore.getState().setSelectSelectionDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = renderLocalOverlay(<SelectToolLocalOverlayLayer />, localOverlayStore, {
      x: -5,
      y: 8,
      zoom: 2,
    })

    const rect = container.querySelector('rect')
    expect(rect).toHaveAttribute('x', '15')
    expect(rect).toHaveAttribute('y', '48')
    expect(rect).toHaveAttribute('width', '60')
    expect(rect).toHaveAttribute('height', '80')
    expect(rect).toHaveAttribute('stroke-width', '1.5')
  })
})
