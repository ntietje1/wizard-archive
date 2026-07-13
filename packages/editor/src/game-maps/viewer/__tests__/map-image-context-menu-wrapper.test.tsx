import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { Ref } from 'react'
import type { MapPinId } from '../../../resources/domain-id'
import type { ContextMenuHostRef } from '../../../context-menu/components/host'
import { MapViewProvider } from '../map-view-context'
import { MapImageContextMenuWrapper } from '../map-image-context-menu-wrapper'
import { useMapView } from '../use-map-view'
import { WorkspaceContextMenu } from '../../../workspace/context-menu/context-menu'
import { createGameMapFixture, createMapPinFixture } from './test-fixtures'

vi.mock('../../../workspace/context-menu/context-menu', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    WorkspaceContextMenu: vi.fn(({ ref }: { ref?: Ref<ContextMenuHostRef> }) => {
      useImperativeHandle(ref, () => ({
        open: vi.fn(),
        close: vi.fn(),
      }))
      return <div data-testid="workspace-context-menu" />
    }),
  }
})

describe('MapImageContextMenuWrapper', () => {
  it('clears the active pin before opening the map-level context menu', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture({ map })
    const contextMenuRef = { current: null as ContextMenuHostRef | null }

    const selectedMap = {
      ...map,
      imageUrl: 'active-layer.png',
    }

    render(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[pin]}
        pinOperations={{ removeMapPin: vi.fn(), updateMapPinVisibility: vi.fn() }}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <ActivePinControls pinId={pin.id} />
        <MapImageContextMenuWrapper
          contextMenuRef={contextMenuRef}
          map={map}
          selectedMap={selectedMap}
        />
      </MapViewProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activate pin' }))
    expect(screen.getByTestId('active-pin')).toHaveTextContent(pin.id)

    act(() => {
      contextMenuRef.current?.open({ x: 10, y: 20 })
    })

    expect(screen.getByTestId('active-pin')).toHaveTextContent('none')
  })

  it('keeps the canonical map item while selecting the active image for downloads', () => {
    const map = createGameMapFixture()
    const selectedMap = {
      ...map,
      imageUrl: 'active-layer.png',
    }

    render(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[]}
        pinOperations={{ removeMapPin: vi.fn(), updateMapPinVisibility: vi.fn() }}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <MapImageContextMenuWrapper
          contextMenuRef={{ current: null }}
          map={map}
          selectedMap={selectedMap}
        />
      </MapViewProvider>,
    )

    expect(WorkspaceContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: map,
        contextOverrides: {
          primaryItem: selectedMap,
          selectedItems: [selectedMap],
        },
      }),
      undefined,
    )
  })

  it('clears the active pin only after dialog or menu close completes', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture({ map })

    render(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[pin]}
        pinOperations={{ removeMapPin: vi.fn(), updateMapPinVisibility: vi.fn() }}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <ActivePinControls pinId={pin.id} />
        <MapImageContextMenuWrapper
          contextMenuRef={{ current: null }}
          map={map}
          selectedMap={map}
        />
      </MapViewProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activate pin' }))
    act(() => {
      lastWorkspaceContextMenuProps()?.onDialogOpen?.()
      lastWorkspaceContextMenuProps()?.onClose?.()
    })
    expect(screen.getByTestId('active-pin')).toHaveTextContent(pin.id)

    act(() => {
      lastWorkspaceContextMenuProps()?.onDialogClose?.()
    })
    expect(screen.getByTestId('active-pin')).toHaveTextContent('none')

    fireEvent.click(screen.getByRole('button', { name: 'Activate pin' }))
    act(() => {
      lastWorkspaceContextMenuProps()?.onClose?.()
    })
    expect(screen.getByTestId('active-pin')).toHaveTextContent('none')
  })
})

function lastWorkspaceContextMenuProps() {
  return vi.mocked(WorkspaceContextMenu).mock.lastCall?.[0]
}

function ActivePinControls({ pinId }: { pinId: MapPinId }) {
  const mapView = useMapView()
  return (
    <>
      <button type="button" onClick={() => mapView.setActivePinId(pinId)}>
        Activate pin
      </button>
      <p data-testid="active-pin">{mapView.activePin?.id ?? 'none'}</p>
    </>
  )
}
