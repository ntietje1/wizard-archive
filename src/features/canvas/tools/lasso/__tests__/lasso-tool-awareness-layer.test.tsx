import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LassoAwarenessLayer } from '../lasso-tool-awareness-layer'
import { LassoToolLocalOverlayLayer } from '../lasso-tool-local-overlay-layer'
import { clearLassoToolLocalOverlay, setLassoToolLocalPoints } from '../lasso-tool-local-overlay'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

describe('Lasso layers', () => {
  beforeEach(() => {
    clearLassoToolLocalOverlay()
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
        dragging: null,
        resizing: null,
        selectedNodeIds: null,
      },
    ]

    const { container } = render(<LassoAwarenessLayer remoteUsers={remoteUsers} />)

    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
    expect(polygon).toHaveAttribute('points', '0,0 40,0 40,40')
    expect(polygon).toHaveAttribute('fill', '#0f0')
  })

  it('renders the local lasso overlay from the lasso slice store', () => {
    setLassoToolLocalPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ])

    const { container } = render(<LassoToolLocalOverlayLayer />)

    const polygon = container.querySelector('polygon')
    expect(polygon).toBeInTheDocument()
    expect(polygon).toHaveAttribute('points', '0,0 40,0 40,40')
  })
})
