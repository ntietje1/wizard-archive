import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { CanvasRemoteCursors } from '../canvas-remote-cursors'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { RemoteUser } from '../../utils/canvas-awareness-types'

describe('CanvasRemoteCursors', () => {
  it('places a newly visible remote cursor at its projected screen position immediately', () => {
    const engine = createCanvasEngine()
    try {
      engine.setViewportLive({ x: 5, y: -10, zoom: 2 })

      render(
        <CanvasEngineProvider engine={engine}>
          <CanvasRemoteCursors remoteUsers={[createRemoteUser({ x: 10, y: 20 })]} />
        </CanvasEngineProvider>,
      )

      expect(screen.getByTestId('canvas-remote-cursor')).toHaveStyle({
        transform: 'translate(25px, 30px)',
      })
      expect(screen.getByTestId('canvas-remote-cursor')).toHaveAttribute('aria-hidden', 'true')
    } finally {
      engine.destroy()
    }
  })
})

function createRemoteUser(cursor: { x: number; y: number }): RemoteUser {
  return {
    clientId: 1,
    cursor,
    presence: {},
    resizing: null,
    selection: null,
    user: {
      color: '#2563eb',
      name: 'Remote User',
    },
  }
}
