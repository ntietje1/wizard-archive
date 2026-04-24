import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DrawAwarenessLayer } from '../draw-tool-awareness-layer'
import { DrawToolLocalOverlayLayer } from '../draw-tool-local-overlay-layer'
import { clearDrawToolLocalOverlay, setDrawToolLocalDrawing } from '../draw-tool-local-overlay'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

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
        dragging: null,
        resizing: null,
        selectedNodeIds: null,
      },
    ]

    const { container } = render(<DrawAwarenessLayer remoteUsers={remoteUsers} />)

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
        dragging: null,
        resizing: null,
        selectedNodeIds: null,
      },
    ]

    const { container } = render(<DrawAwarenessLayer remoteUsers={remoteUsers} />)

    expect(container.querySelector('path')).not.toBeInTheDocument()
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

    const { container } = render(<DrawToolLocalOverlayLayer />)

    expect(container.querySelector('path')).toBeInTheDocument()
  })
})
