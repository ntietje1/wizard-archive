import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { measureCanvasPerformance } from '../canvas-performance-metrics'

describe('canvas performance metrics', () => {
  afterEach(() => {
    window.__WA_CANVAS_PERF__ = undefined
  })

  it('keeps collector failures out of measured editor work', () => {
    const entries: Array<unknown> = []
    vi.spyOn(entries, 'push').mockImplementation(() => {
      throw new Error('collector unavailable')
    })
    window.__WA_CANVAS_PERF__ = {
      enabled: true,
      entries: entries as Array<never>,
      record: vi.fn(() => {
        throw new Error('collector unavailable')
      }),
    }

    expect(measureCanvasPerformance('canvas.test', {}, () => 'result')).toBe('result')
  })
})
