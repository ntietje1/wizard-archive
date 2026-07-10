import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import type { MapPinId, SidebarItemId } from '../../../../../../shared/common/ids'
import type { MapPinWithItem } from '../../../game-maps/item-contract'
import { MapModeBanners } from '../map-mode-banners'

describe('MapModeBanners', () => {
  it('shows pending placement instructions for one item', () => {
    render(
      <MapModeBanners
        pendingPinItems={{ itemIds: ['note-1' as SidebarItemId] }}
        pendingPinMove={null}
        draggingPin={null}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Click on map to place pin. Press Escape to cancel.',
    )
  })

  it('pluralizes pending placement instructions for multiple items', () => {
    render(
      <MapModeBanners
        pendingPinItems={{ itemIds: ['note-1' as SidebarItemId, 'note-2' as SidebarItemId] }}
        pendingPinMove={null}
        draggingPin={null}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Click on map to place 2 pins. Press Escape to cancel.',
    )
  })

  it('shows pending movement instructions when no drag is active', () => {
    render(
      <MapModeBanners
        pendingPinItems={null}
        pendingPinMove={{ pinId: 'map-pin-1' as MapPinId }}
        draggingPin={null}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Click on map or drag to move pin. Press Escape to cancel.',
    )
  })

  it('shows the drag feedback while a pin is actively being dragged', () => {
    render(
      <MapModeBanners
        pendingPinItems={null}
        pendingPinMove={{ pinId: 'map-pin-1' as MapPinId }}
        draggingPin={{ pin: { id: 'map-pin-1' } as MapPinWithItem }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Release to move pin. Press Escape to cancel.',
    )
  })

  it('renders no banner when no map mode is active', () => {
    const { container } = render(
      <MapModeBanners pendingPinItems={null} pendingPinMove={null} draggingPin={null} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
