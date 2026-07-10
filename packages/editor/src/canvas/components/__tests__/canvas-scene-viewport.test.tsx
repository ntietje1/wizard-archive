import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { applyCanvasBackgroundViewport } from '../canvas-background-viewport-style'
import { CanvasSceneViewport } from '../canvas-scene-viewport'
import { createCanvasDomRuntime } from '../../system/canvas-dom-runtime'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasViewport } from '../../types/canvas-domain-types'
import type { HTMLAttributes } from 'react'

describe('CanvasSceneViewport', () => {
  let domRuntime: ReturnType<typeof createCanvasDomRuntime> | null = null
  let engine: ReturnType<typeof createCanvasEngine> | null = null

  afterEach(() => {
    engine?.destroy()
    domRuntime?.destroy()
    engine = null
    domRuntime = null
  })

  it('scales and pans the live canvas background from the viewport', async () => {
    domRuntime = createCanvasDomRuntime()
    engine = createCanvasEngine({ domRuntime })
    const zoom = 3
    const expectedGridSize = `${36 * zoom}px`

    render(
      <CanvasSceneViewport
        engine={engine}
        domRuntime={domRuntime}
        surfaceRef={{ current: null }}
        viewportRef={{ current: null }}
        testId="canvas-scene"
        backgroundTestId="canvas-background"
      >
        <div />
      </CanvasSceneViewport>,
    )

    act(() => {
      engine?.setViewportLive({ x: 42, y: -18, zoom })
    })

    await waitFor(() => {
      expect(screen.getByTestId('canvas-background')).toHaveStyle({
        backgroundPosition: '42px -18px',
        backgroundSize: `${expectedGridSize} ${expectedGridSize}`,
      })
    })
  })

  it('registers the viewport element and schedules its initial render state', () => {
    domRuntime = createCanvasDomRuntime()
    engine = createCanvasEngine({ domRuntime })
    engine.setViewportLive({ x: 12, y: -8, zoom: 1.5 })
    const unregister = vi.fn()
    const registerViewportElement = vi
      .spyOn(domRuntime, 'registerViewportElement')
      .mockReturnValue(unregister)
    const scheduleViewportTransform = vi.spyOn(domRuntime, 'scheduleViewportTransform')
    const scheduleCameraState = vi.spyOn(domRuntime, 'scheduleCameraState')
    const flush = vi.spyOn(domRuntime, 'flush')

    const view = render(
      <CanvasSceneViewport
        engine={engine}
        domRuntime={domRuntime}
        surfaceRef={{ current: null }}
        viewportRef={{ current: null }}
        testId="canvas-scene"
      >
        <div />
      </CanvasSceneViewport>,
    )

    expect(registerViewportElement).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    expect(scheduleViewportTransform).toHaveBeenCalledWith({ x: 12, y: -8, zoom: 1.5 })
    expect(scheduleCameraState).toHaveBeenCalledWith(engine.getSnapshot().cameraState)
    expect(flush).toHaveBeenCalled()

    view.unmount()

    expect(unregister).toHaveBeenCalledTimes(1)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to one-times background scale for invalid zoom %s',
    (zoom) => {
      const element = document.createElement('div')

      applyCanvasBackgroundViewport(element, { x: 10, y: 20, zoom } as CanvasViewport)

      expect(element.style.backgroundSize).toBe('36px 36px')
      expect(element.style.backgroundPosition).toBe('10px 20px')
    },
  )

  it('falls back to the origin for invalid background offsets', () => {
    const element = document.createElement('div')

    applyCanvasBackgroundViewport(element, {
      x: Number.POSITIVE_INFINITY,
      y: Number.NaN,
      zoom: 2,
    } as CanvasViewport)

    expect(element.style.backgroundSize).toBe('72px 72px')
    expect(element.style.backgroundPosition).toBe('0px 0px')
  })

  it('keeps required surface markers when callers provide surface props', () => {
    domRuntime = createCanvasDomRuntime()
    engine = createCanvasEngine({ domRuntime })

    render(
      <CanvasSceneViewport
        engine={engine}
        domRuntime={domRuntime}
        surfaceRef={{ current: null }}
        viewportRef={{ current: null }}
        testId="canvas-scene"
        surfaceProps={
          {
            'data-canvas-pane': 'false',
            'data-testid': 'caller-test-id',
          } as HTMLAttributes<HTMLDivElement>
        }
      >
        <div />
      </CanvasSceneViewport>,
    )

    const scene = screen.getByTestId('canvas-scene')
    expect(scene).toHaveAttribute('data-canvas-pane', 'true')
    expect(screen.queryByTestId('caller-test-id')).not.toBeInTheDocument()
  })
})
