import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SelectAwarenessLayer } from '../select-tool-awareness-layer'
import { SelectToolLocalOverlayLayer } from '../select-tool-local-overlay-layer'
import {
  clearSelectToolLocalOverlay,
  setSelectToolSelectionDragRect,
} from '../select-tool-local-overlay'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'
import type { CanvasEngine } from '../../../system/canvas-engine'
import type { ReactNode } from 'react'

function renderWithEngine(ui: ReactNode, engine: CanvasEngine = createCanvasEngine()) {
  return render(<CanvasEngineProvider engine={engine}>{ui}</CanvasEngineProvider>)
}

describe('SelectAwarenessLayer', () => {
  beforeEach(() => {
    clearSelectToolLocalOverlay()
  })

  it('ignores remote users without a valid marquee awareness payload', () => {
    const remoteUsers: Array<RemoteUser> = [
      {
        clientId: 1,
        user: { name: 'Idle tester', color: '#00f' },
        presence: {},
        cursor: null,
        resizing: null,
        selectedNodeIds: null,
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
        selectedNodeIds: null,
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
        selectedNodeIds: null,
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
        selectedNodeIds: null,
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
  beforeEach(() => {
    clearSelectToolLocalOverlay()
  })

  it('renders the local marquee overlay from the select slice store', () => {
    setSelectToolSelectionDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = renderWithEngine(<SelectToolLocalOverlayLayer />)

    const rect = container.querySelector('rect')
    expect(rect).toBeInTheDocument()
    expect(rect).toHaveAttribute('x', '10')
    expect(rect).toHaveAttribute('y', '20')
    expect(rect).toHaveAttribute('width', '30')
    expect(rect).toHaveAttribute('height', '40')
  })

  it('projects the local marquee overlay into screen space under pan and zoom', () => {
    const engine = createCanvasEngine()
    engine.setViewport({ x: -5, y: 8, zoom: 2 })
    setSelectToolSelectionDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = renderWithEngine(<SelectToolLocalOverlayLayer />, engine)

    const rect = container.querySelector('rect')
    expect(rect).toHaveAttribute('x', '15')
    expect(rect).toHaveAttribute('y', '48')
    expect(rect).toHaveAttribute('width', '60')
    expect(rect).toHaveAttribute('height', '80')
    expect(rect).toHaveAttribute('stroke-width', '1.5')
  })
})
