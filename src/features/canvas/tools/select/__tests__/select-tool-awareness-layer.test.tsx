import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SelectAwarenessLayer } from '../select-tool-awareness-layer'
import { SelectToolLocalOverlayLayer } from '../select-tool-local-overlay-layer'
import {
  clearSelectToolLocalOverlay,
  setSelectToolSelectionDragRect,
} from '../select-tool-local-overlay'
import type { RemoteUser } from '../../../utils/canvas-awareness-types'

describe('SelectAwarenessLayer', () => {
  beforeEach(() => {
    clearSelectToolLocalOverlay()
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
        dragging: null,
        resizing: null,
        selectedNodeIds: null,
      },
    ]

    const { container } = render(<SelectAwarenessLayer remoteUsers={remoteUsers} />)

    expect(container.querySelector('rect')).toBeInTheDocument()
  })

  it('renders the local marquee overlay from the select slice store', () => {
    setSelectToolSelectionDragRect({ x: 10, y: 20, width: 30, height: 40 })

    const { container } = render(<SelectToolLocalOverlayLayer />)

    expect(container.querySelector('rect')).toBeInTheDocument()
  })
})
