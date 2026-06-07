import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapCanvasStage } from '../map-canvas-stage'
import { createGameMap } from '~/test/factories/sidebar-item-factory'
import type { GameMapWithContent } from 'shared/game-maps/types'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

describe('MapCanvasStage', () => {
  it('renders a persistent failed state instead of a broken image surface', () => {
    const onMapCanvasContextMenu = vi.fn()

    render(
      <MapCanvasStage
        map={
          {
            ...createGameMap({ imageUrl: 'https://example.com/map.png' }),
            ancestors: [],
            pins: [],
          } as GameMapWithContent
        }
        mapContainerRef={createRef<HTMLDivElement>()}
        transformWrapperRef={createRef<ReactZoomPanPinchRef>()}
        imageRef={createRef<HTMLImageElement>()}
        pinsContainerRef={createRef<HTMLDivElement>()}
        imageLoaded={false}
        imageError
        savedTransform={{ scale: 1, positionX: 0, positionY: 0 }}
        mapCursor="default"
        shouldDisablePanning={false}
        mapDragOutcome={null}
        pins={[]}
        isPinGhost={() => false}
        hoveredPinId={null}
        draggingPinId={null}
        moveModePinId={null}
        hasPinAction={false}
        onTransformChange={vi.fn()}
        onImageLoad={vi.fn()}
        onImageError={vi.fn()}
        onMapClick={vi.fn()}
        onMapKeyboardAction={vi.fn()}
        onMapCanvasContextMenu={onMapCanvasContextMenu}
        onPinHover={vi.fn()}
        onPinClick={vi.fn()}
        onPinContextMenu={vi.fn()}
        onPinDragStart={vi.fn()}
        emptyImageContent={<div>No image</div>}
      />,
    )

    const failedState = screen.getByRole('alert')
    expect(failedState).toHaveTextContent('Failed to load map image.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    fireEvent.contextMenu(failedState)

    expect(onMapCanvasContextMenu).toHaveBeenCalledOnce()
  })
})
