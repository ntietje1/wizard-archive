import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { MapCanvasStage } from '../map-canvas-stage'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { ComponentProps } from 'react'
import { createGameMapFixture, createMapPinFixture, createNoteFixture } from './test-fixtures'

describe('MapCanvasStage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a persistent failed state instead of a broken image surface', () => {
    const onMapCanvasContextMenu = vi.fn()

    renderMapCanvasStage({
      imageLoaded: false,
      imageError: true,
      mapCursor: 'default',
      shouldDisablePanning: false,
      hasPinAction: false,
      onMapCanvasContextMenu,
    })

    const failedState = screen.getByRole('alert')
    expect(failedState).toHaveTextContent('Failed to load map image.')

    fireEvent.contextMenu(failedState)

    expect(onMapCanvasContextMenu).toHaveBeenCalledOnce()
  })

  it('activates map canvas and pin controls as native buttons', () => {
    const onMapClick = vi.fn()
    const onMapKeyboardAction = vi.fn()
    const onPinClick = vi.fn()
    const pin = createMapPinFixture({ item: createNoteFixture({ name: 'Pinned note' }) })

    renderMapCanvasStage({
      mapCursor: 'crosshair',
      shouldDisablePanning: true,
      pins: [pin],
      hasPinAction: true,
      onMapClick,
      onMapKeyboardAction,
      onPinClick,
    })

    const mapCanvasAction = screen.getByRole('button', { name: 'Map canvas' })
    const pinAction = screen.getByRole('button', { name: 'Pinned note' })

    expect(mapCanvasAction.tagName).toBe('BUTTON')
    expect(pinAction.tagName).toBe('BUTTON')

    fireEvent.click(mapCanvasAction)
    fireEvent.keyDown(mapCanvasAction, { key: 'Enter' })
    fireEvent.keyDown(mapCanvasAction, { key: ' ' })
    fireEvent.click(pinAction)

    expect(onMapClick).toHaveBeenCalledOnce()
    expect(onMapKeyboardAction).toHaveBeenCalledTimes(2)
    expect(onPinClick).toHaveBeenCalledOnce()
  })

  it('remounts the image element when the active image changes', () => {
    const firstMap = createGameMapFixture({ imageUrl: 'https://example.com/first.png' })
    const { rerender } = renderMapCanvasStage({ map: firstMap })
    const firstImage = screen.getByRole('img', { name: firstMap.name })
    const secondMap = createGameMapFixture({ imageUrl: 'https://example.com/second.png' })

    rerender(<MapCanvasStage {...createMapCanvasStageProps({ map: secondMap })} />)

    expect(screen.getByRole('img', { name: secondMap.name })).not.toBe(firstImage)
  })
})

function renderMapCanvasStage(overrides: Partial<ComponentProps<typeof MapCanvasStage>> = {}) {
  return render(<MapCanvasStage {...createMapCanvasStageProps(overrides)} />)
}

function createMapCanvasStageProps(
  overrides: Partial<ComponentProps<typeof MapCanvasStage>> = {},
): ComponentProps<typeof MapCanvasStage> {
  return {
    map: createGameMapFixture({ imageUrl: 'https://example.com/map.png' }),
    mapContainerRef: createRef<HTMLDivElement>(),
    transformWrapperRef: createRef<ReactZoomPanPinchRef>(),
    imageRef: createRef<HTMLImageElement>(),
    pinsContainerRef: createRef<HTMLDivElement>(),
    imageLoaded: true,
    imageError: false,
    savedTransform: { scale: 1, positionX: 0, positionY: 0 },
    mapCursor: 'default',
    shouldDisablePanning: false,
    mapDragOutcome: null,
    pins: [],
    isPinGhost: () => false,
    hoveredPinId: null,
    draggingPinId: null,
    moveModePinId: null,
    hasPinAction: false,
    onTransformChange: vi.fn(),
    onImageLoad: vi.fn(),
    onImageError: vi.fn(),
    onMapClick: vi.fn(),
    onMapKeyboardAction: vi.fn(),
    onMapCanvasContextMenu: vi.fn(),
    onPinHover: vi.fn(),
    onPinClick: vi.fn(),
    onPinContextMenu: vi.fn(),
    onPinDragStart: vi.fn(),
    emptyImageContent: <div>No image</div>,
    ...overrides,
  }
}
