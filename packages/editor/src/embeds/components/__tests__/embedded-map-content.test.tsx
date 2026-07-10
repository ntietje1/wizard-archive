import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { MapItemWithContent } from '../../../game-maps/item-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { ReactNode } from 'react'
import { assertResourceItemName } from '../../../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import { EmbeddedMapContent } from '../embedded-map-content'
import { EmbeddedMapStateSourceProvider } from '../../../game-maps/embedded-state-context'
import type { EmbeddedMapStateSource } from '../../../game-maps/embedded-state-context'

describe('EmbeddedMapContent', () => {
  it('requires embedded map state resolution wiring', () => {
    expect(() => render(<EmbeddedMapContent map={createMap()} />)).toThrow(
      'Embedded map state source is unavailable',
    )
  })

  it('reports the loaded map image aspect ratio through the embed media layout contract', () => {
    const onMediaLayout = vi.fn()

    renderWithMapState(<EmbeddedMapContent map={createMap()} onMediaLayout={onMediaLayout} />)

    const image = screen.getByRole('img', { name: 'Dungeon' })
    Object.defineProperty(image, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(image, 'naturalHeight', { value: 400, configurable: true })

    fireEvent.load(image)

    expect(onMediaLayout).toHaveBeenCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 2,
    })
  })

  it('renders the map preview fallback when the map has no image', () => {
    renderWithMapState(<EmbeddedMapContent map={createMap({ imageUrl: null })} />)

    expect(screen.getByText('Map image not available')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Dungeon' })).not.toBeInTheDocument()
  })

  it('returns to the map preview fallback when the map image fails', () => {
    renderWithMapState(<EmbeddedMapContent map={createMap()} />)

    fireEvent.error(screen.getByRole('img', { name: 'Dungeon' }))

    expect(screen.getByText('Map image not available')).toBeInTheDocument()
  })

  it('renders the active layer image and only that layer pins', () => {
    const map = createMap({
      imageUrl: 'legacy-map.png',
      layers: [
        { id: 'layer-1', imageAssetId: null, imageUrl: 'layer-1.png', name: 'Ground' },
        { id: 'layer-2', imageAssetId: null, imageUrl: 'layer-2.png', name: 'Basement' },
      ],
    })
    const source: EmbeddedMapStateSource = {
      resolveEmbeddedMapState: () => ({
        status: 'available',
        pins: [
          createPin({ id: 'pin-default' }),
          createPin({ id: 'pin-layer-1', layerId: 'layer-1' }),
          createPin({ id: 'pin-layer-2', layerId: 'layer-2' }),
        ],
        isPinGhost: () => false,
      }),
    }
    const { container } = renderWithMapState(<EmbeddedMapContent map={map} />, source)

    const image = screen.getByRole('img', { name: 'Dungeon - Ground' })
    expect(image).toHaveAttribute('src', 'layer-1.png')
    fireEvent.load(image)

    expect(container.querySelector('[data-pin-id="pin-default"]')).toBeInTheDocument()
    expect(container.querySelector('[data-pin-id="pin-layer-1"]')).toBeInTheDocument()
    expect(container.querySelector('[data-pin-id="pin-layer-2"]')).not.toBeInTheDocument()
  })
})

function renderWithMapState(children: ReactNode, source = createMapStateSource()) {
  return render(
    <EmbeddedMapStateSourceProvider source={source}>{children}</EmbeddedMapStateSourceProvider>,
  )
}

function createMapStateSource(): EmbeddedMapStateSource {
  return {
    resolveEmbeddedMapState: () => ({
      status: 'available',
      pins: [],
      isPinGhost: () => false,
    }),
  }
}

function createMap(overrides: Partial<MapItemWithContent> = {}): MapItemWithContent {
  const map = {
    id: 'map-id' as SidebarItemId,
    createdAt: 0,
    name: assertResourceItemName('Dungeon'),
    iconName: null,
    color: null,
    slug: 'dungeon',
    campaignId: 'campaign-id',
    parentId: null,
    type: RESOURCE_TYPES.gameMaps,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user-id',
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: 'owner',
    previewUrl: null,
    isActive: true,
    isTrashed: false,
    ancestors: [],
    imageAssetId: null,
    imageUrl: 'map.png',
    pins: [],
    ...overrides,
  }
  return map as unknown as MapItemWithContent
}

function createPin({
  id,
  layerId,
}: {
  id: string
  layerId?: string | null
}): MapItemWithContent['pins'][number] {
  const item = {
    id: 'note-id' as SidebarItemId,
    name: assertResourceItemName('Pinned Note'),
    type: RESOURCE_TYPES.notes,
    color: null,
    iconName: null,
  }

  return {
    id: id,
    createdAt: 0,
    item,
    itemId: item.id,
    layerId,
    mapId: 'map-id' as SidebarItemId,
    visible: true,
    x: 50,
    y: 50,
  } as unknown as MapItemWithContent['pins'][number]
}
