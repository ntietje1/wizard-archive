import { describe, expect, it } from 'vite-plus/test'
import { createCanvasToolLocalOverlayStore } from '../canvas-tool-local-overlay-store'

describe('createCanvasToolLocalOverlayStore', () => {
  it('exposes a plain store api instead of a render hook', () => {
    const store = createCanvasToolLocalOverlayStore()

    expect(typeof store).toBe('object')
    expect(store.getState).toEqual(expect.any(Function))
    expect(store.subscribe).toEqual(expect.any(Function))
  })
})
