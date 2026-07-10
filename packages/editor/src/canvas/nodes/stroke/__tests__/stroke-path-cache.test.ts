import { describe, expect, it, vi } from 'vite-plus/test'
import {
  clearAllStrokePathCache,
  clearStrokePathCache,
  getCachedStrokeDetailPath,
} from '../stroke-path-cache'
import type { StrokeNodeData } from '../stroke-node-model'

const getStrokeMock = vi.hoisted(() =>
  vi.fn((_points: Array<[number, number, number]>, options: { size: number }) => [
    [0, 0],
    [options.size, 0],
    [options.size, options.size],
  ]),
)

vi.mock('perfect-freehand', () => ({
  getStroke: getStrokeMock,
}))

describe('stroke path cache', () => {
  it('bounds cached detail paths for dynamic render sizes', () => {
    const data: StrokeNodeData = {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      color: 'var(--foreground)',
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      size: 1,
    }

    clearAllStrokePathCache()
    getStrokeMock.mockClear()

    for (let size = 1; size <= 40; size += 1) {
      getCachedStrokeDetailPath('stroke-1', data, size)
    }
    getCachedStrokeDetailPath('stroke-1', data, 1)

    expect(getStrokeMock).toHaveBeenCalledTimes(41)
  })

  it('generates only the requested detail size for a cold cache miss', () => {
    const data: StrokeNodeData = {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      color: 'var(--foreground)',
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      size: 4,
    }

    clearAllStrokePathCache()
    getStrokeMock.mockClear()

    getCachedStrokeDetailPath('stroke-1', data, 12)

    expect(getStrokeMock).toHaveBeenCalledTimes(1)
  })

  it('drops cached paths for an unmounted stroke node id', () => {
    const data: StrokeNodeData = {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      color: 'var(--foreground)',
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ],
      size: 4,
    }

    clearAllStrokePathCache()
    getStrokeMock.mockClear()

    getCachedStrokeDetailPath('stroke-1', data, 4)
    getCachedStrokeDetailPath('stroke-1', data, 4)
    clearStrokePathCache('stroke-1')
    getCachedStrokeDetailPath('stroke-1', data, 4)

    expect(getStrokeMock).toHaveBeenCalledTimes(2)
  })
})
