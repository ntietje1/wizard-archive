import { describe, expect, it } from 'vite-plus/test'
import { projectCanvasResizeNodeBounds, resolveCanvasResizeBounds } from '../canvas-resize-geometry'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_A = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')
const NODE_B = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-222222222222')

describe('canvas resize geometry', () => {
  it('projects a multi-node resize from one selection transform', () => {
    const initialBounds = { x: 0, y: 0, width: 480, height: 80 }
    const nodeBounds = new Map([
      [NODE_A, { x: 0, y: 0, width: 180, height: 80 }],
      [NODE_B, { x: 300, y: 0, width: 180, height: 80 }],
    ])
    const bounds = resolveCanvasResizeBounds(
      'bottom-right',
      initialBounds,
      { x: 960, y: 160 },
      nodeBounds,
      false,
    )

    expect(bounds).toEqual({ x: 0, y: 0, width: 960, height: 160 })
    expect(projectCanvasResizeNodeBounds(initialBounds, bounds, nodeBounds)).toEqual(
      new Map([
        [NODE_A, { x: 0, y: 0, width: 360, height: 160 }],
        [NODE_B, { x: 600, y: 0, width: 360, height: 160 }],
      ]),
    )
  })

  it('supports side handles, minimum node sizes, and square corner constraints', () => {
    const initialBounds = { x: 100, y: 100, width: 180, height: 80 }
    const nodeBounds = new Map([[NODE_A, initialBounds]])

    expect(
      resolveCanvasResizeBounds('left', initialBounds, { x: 400, y: 0 }, nodeBounds, false),
    ).toEqual({ x: 240, y: 100, width: 40, height: 80 })
    expect(
      resolveCanvasResizeBounds(
        'bottom-right',
        initialBounds,
        { x: 320, y: 200 },
        nodeBounds,
        true,
      ),
    ).toEqual({ x: 100, y: 100, width: 220, height: 220 })
  })
})
