import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ComponentProps } from 'react'
import type { MapItemWithContent } from '../../../game-maps/item-contract'
import type { MapViewerSource } from '../source'
import type { MapCanvasStage } from '../map-canvas-stage'
import { MapViewer } from '../viewer'
import { completedResourceOperation } from '../../../filesystem/transaction-contract'
import { createGameMapFixture } from './test-fixtures'

vi.mock('@wizard-archive/ui/components/client-only', () => ({
  ClientOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../map-canvas-stage', () => ({
  MapCanvasStage: ({ imageAlt, map }: ComponentProps<typeof MapCanvasStage>) => (
    <div data-testid="map-canvas-stage" data-image-alt={imageAlt} data-image-url={map.imageUrl} />
  ),
}))

vi.mock('../map-layer-switcher', () => ({
  MapLayerSwitcher: ({
    layers,
    onSelectLayer,
  }: {
    layers: Array<{ id: string; name: string }>
    onSelectLayer: (layerId: string) => void
  }) => (
    <div>
      {layers.map((layer) => (
        <button key={layer.id} type="button" onClick={() => onSelectLayer(layer.id)}>
          {layer.name}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../map-image-context-menu-wrapper', () => ({
  MapImageContextMenuWrapper: () => null,
}))

vi.mock('../use-map-sidebar-item-drop-target', () => ({
  useMapSidebarItemDropTarget: vi.fn(),
}))

vi.mock('../use-map-transform-controls', () => ({
  useMapTransformControls: () => ({
    handleResetTransform: vi.fn(),
    handleTransformChange: vi.fn(),
    handleZoomIn: vi.fn(),
    handleZoomOut: vi.fn(),
    savedTransform: { scale: 1, positionX: 0, positionY: 0 },
    transformWrapperRef: { current: null },
  }),
}))

vi.mock('../use-map-pin-interactions', () => ({
  useMapPinInteractions: () => ({
    closePinContextMenu: vi.fn(),
    draggingPin: null,
    handleMapClick: vi.fn(),
    handleMapKeyboardAction: vi.fn(),
    handleMapPinActionContextMenu: vi.fn(() => false),
    handlePinClick: vi.fn(),
    handlePinContextMenu: vi.fn(),
    handlePinDragStart: vi.fn(),
    mapCursor: 'default',
    pendingPinItems: null,
    pendingPinMove: null,
    pinContextMenu: null,
    requestPinMove: vi.fn(),
    requestPinPlacement: vi.fn(),
    shouldDisablePanning: false,
  }),
}))

describe('MapViewer', () => {
  it('resets the selected layer when the viewed map changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<MapViewer item={createMap('map-a', 'A')} source={source} />)

    await user.click(screen.getByRole('button', { name: 'A Layer 2' }))
    expect(screen.getByTestId('map-canvas-stage')).toHaveAttribute(
      'data-image-url',
      'map-a-layer-2.png',
    )

    rerender(<MapViewer item={createMap('map-b', 'B')} source={source} />)

    expect(screen.getByTestId('map-canvas-stage')).toHaveAttribute(
      'data-image-url',
      'map-b-layer-1.png',
    )
  })
})

const source: MapViewerSource = {
  canEditMap: () => true,
  canViewItem: () => true,
  createMapPins: vi.fn(),
  openItem: vi.fn(),
  removeMapPin: vi.fn(),
  resolveEmbeddedMapState: () => ({ status: 'available', pins: [], isPinGhost: () => false }),
  transformStore: {
    loadMapTransform: () => ({ scale: 1, positionX: 0, positionY: 0 }),
    saveMapTransform: vi.fn(),
  },
  updateMapImage: vi.fn(() =>
    completedResourceOperation({
      kind: 'mapImageUpdated',
      affectedCount: 1,
    }),
  ),
  updateMapPin: vi.fn(),
  updateMapPinVisibility: vi.fn(),
}

function createMap(id: string, name: string): MapItemWithContent {
  return createGameMapFixture({
    id: id as MapItemWithContent['id'],
    imageUrl: `${id}.png`,
    name: `${name} Map`,
    layers: [
      {
        id: `${id}-layer-1`,
        name: `${name} Layer 1`,
        imageAssetId: null,
        imageUrl: `${id}-layer-1.png`,
      },
      {
        id: `${id}-layer-2`,
        name: `${name} Layer 2`,
        imageAssetId: null,
        imageUrl: `${id}-layer-2.png`,
      },
    ],
  })
}
