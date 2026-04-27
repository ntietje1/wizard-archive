import { describe, expect, it } from 'vitest'
import { getCanvasFitViewport } from '../canvas-fit-view'

describe('getCanvasFitViewport', () => {
  it('normalizes inverted zoom bounds before clamping', () => {
    const viewport = getCanvasFitViewport({
      nodes: [
        {
          id: 'node-1',
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          height: 100,
          data: {},
        },
      ],
      width: 200,
      height: 200,
      minZoom: 2,
      maxZoom: 0.5,
      padding: 0,
    })

    expect(viewport?.zoom).toBe(2)
  })

  it('keeps natural zoom when it falls inside normalized inverted zoom bounds', () => {
    const viewport = getCanvasFitViewport({
      nodes: [
        {
          id: 'node-1',
          type: 'text',
          position: { x: 0, y: 0 },
          width: 200,
          height: 200,
          data: {},
        },
      ],
      width: 200,
      height: 200,
      minZoom: 2,
      maxZoom: 0.5,
      padding: 0,
    })

    expect(viewport?.zoom).toBe(1)
  })
})
