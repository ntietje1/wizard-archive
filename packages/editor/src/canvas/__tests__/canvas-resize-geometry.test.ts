import { describe, expect, it } from 'vite-plus/test'
import { projectCanvasResizeNodeBounds, resolveCanvasResize } from '../canvas-resize-geometry'
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
    const bounds = resolveCanvasResize({
      handle: 'bottom-right',
      initialBounds,
      point: { x: 960, y: 160 },
      initialNodeBounds: nodeBounds,
      targetBounds: [],
      square: false,
      snap: false,
      zoom: 1,
    }).bounds

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
      resolveCanvasResize({
        handle: 'left',
        initialBounds,
        point: { x: 400, y: 0 },
        initialNodeBounds: nodeBounds,
        targetBounds: [],
        square: false,
        snap: false,
        zoom: 1,
      }).bounds,
    ).toEqual({ x: 240, y: 100, width: 40, height: 80 })
    expect(
      resolveCanvasResize({
        handle: 'bottom-right',
        initialBounds,
        point: { x: 320, y: 200 },
        initialNodeBounds: nodeBounds,
        targetBounds: [],
        square: true,
        snap: false,
        zoom: 1,
      }).bounds,
    ).toEqual({ x: 100, y: 100, width: 220, height: 220 })
  })

  it('snaps active resize edges only while the primary modifier is active', () => {
    const initialBounds = { x: 0, y: 0, width: 180, height: 80 }
    const options = {
      handle: 'bottom-right' as const,
      initialBounds,
      point: { x: 296, y: 126 },
      initialNodeBounds: new Map([[NODE_A, initialBounds]]),
      targetBounds: [{ x: 300, y: 130, width: 180, height: 80 }],
      square: false,
      zoom: 1,
    }

    expect(resolveCanvasResize({ ...options, snap: false })).toEqual({
      bounds: { x: 0, y: 0, width: 296, height: 126 },
      guides: [],
    })
    expect(resolveCanvasResize({ ...options, snap: true })).toEqual({
      bounds: { x: 0, y: 0, width: 300, height: 130 },
      guides: [
        { orientation: 'vertical', position: 300, start: 0, end: 210 },
        { orientation: 'horizontal', position: 130, start: 0, end: 480 },
      ],
    })
  })

  it('resolves adversarial resize targets within one deterministic candidate budget', () => {
    const initialBounds = { x: 0, y: 0, width: 180, height: 80 }
    const options = {
      handle: 'bottom-right' as const,
      initialBounds,
      point: { x: 296, y: 126 },
      initialNodeBounds: new Map([[NODE_A, initialBounds]]),
      targetBounds: Array.from({ length: 20_000 }, (_, index) => ({
        x: 300 + index,
        y: 130 + index,
        width: 180,
        height: 80,
      })),
      square: false,
      snap: true,
      zoom: 1,
    }

    const first = resolveCanvasResize(options)
    expect(resolveCanvasResize(options)).toEqual(first)
    expect(first.bounds).toEqual({ x: 0, y: 0, width: 300, height: 126 })
  })
})
