import { describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasDomRegistry } from '../canvas-dom-registry'

describe('createCanvasDomRegistry', () => {
  it('reads initial viewport surface bounds from untransformed local element size', () => {
    const registry = createCanvasDomRegistry()
    const surface = document.createElement('div')
    const viewport = document.createElement('div')
    surface.append(viewport)
    Object.defineProperty(surface, 'offsetWidth', { configurable: true, value: 400 })
    Object.defineProperty(surface, 'offsetHeight', { configurable: true, value: 300 })
    Object.defineProperty(viewport, 'offsetWidth', { configurable: true, value: 100 })
    Object.defineProperty(viewport, 'offsetHeight', { configurable: true, value: 100 })
    // Deliberately mismatch surface.getBoundingClientRect (transformed visual size)
    // from offsetWidth/offsetHeight to prove the registry reads the surface's
    // untransformed local dimensions, not the viewport's size or CSS-scaled bounds.
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      bottom: 150,
      height: 150,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    registry.registerViewport(viewport)

    expect(registry.getViewportSurfaceBounds()).toEqual({ width: 400, height: 300 })
  })

  it('uses a zero-size safe default when the viewport has no parent surface', () => {
    const registry = createCanvasDomRegistry()
    const viewport = document.createElement('div')

    registry.registerViewport(viewport)

    expect(registry.getViewportSurfaceBounds()).toEqual({ width: 0, height: 0 })
  })

  it('updates viewport surface bounds after registering again once appended', () => {
    const registry = createCanvasDomRegistry()
    const surface = document.createElement('div')
    const viewport = document.createElement('div')

    registry.registerViewport(viewport)
    expect(registry.getViewportSurfaceBounds()).toEqual({ width: 0, height: 0 })

    Object.defineProperty(surface, 'offsetWidth', { configurable: true, value: 320 })
    Object.defineProperty(surface, 'offsetHeight', { configurable: true, value: 240 })
    surface.append(viewport)
    registry.registerViewport(viewport)

    expect(registry.getViewportSurfaceBounds()).toEqual({ width: 320, height: 240 })
  })

  it('preserves zero surface dimensions when the registered viewport is appended', () => {
    const registry = createCanvasDomRegistry()
    const surface = document.createElement('div')
    const viewport = document.createElement('div')

    Object.defineProperty(surface, 'offsetWidth', { configurable: true, value: 0 })
    Object.defineProperty(surface, 'offsetHeight', { configurable: true, value: 0 })
    surface.append(viewport)

    registry.registerViewport(viewport)

    expect(registry.getViewportSurfaceBounds()).toEqual({ width: 0, height: 0 })
  })

  it('restores the previous inline display after culling is cleared', () => {
    const registry = createCanvasDomRegistry()
    const element = document.createElement('div')
    element.style.display = 'inline-flex'
    registry.registerNode('node-1', element)

    registry.applyCullingDiff({
      nodeIds: new Map([['node-1', true]]),
      edgeIds: new Map(),
    })
    expect(element.style.display).toBe('none')

    registry.applyCullingDiff({
      nodeIds: new Map([['node-1', false]]),
      edgeIds: new Map(),
    })

    expect(element.style.display).toBe('inline-flex')
    expect(element).not.toHaveAttribute('data-canvas-culled')
  })

  it('returns live stroke path entries for render refreshes', () => {
    const registry = createCanvasDomRegistry()
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const paths = {
      path,
      data: {
        points: [[0, 0, 0.5] as [number, number, number]],
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        color: 'var(--foreground)',
        size: 2,
      },
    }

    registry.registerStrokeNodePaths('stroke-1', paths)

    expect([...registry.getStrokeNodePathEntries()][0]?.[1]).toBe(paths)
  })
})
