import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ComponentProps, ReactNode } from 'react'
import type { MapPinId } from '../../../../../../shared/common/ids'
import { MapPinContextMenuWrapper } from '../map-pin-context-menu-wrapper'
import { WorkspaceContextMenu } from '../../../workspace/context-menu/context-menu'
import { MapViewProvider } from '../map-view-context'
import { useMapView } from '../use-map-view'
import {
  createGameMapFixture,
  createMapPinFixture,
  createNoteFixture,
  testId,
} from './test-fixtures'

vi.mock('../../../workspace/context-menu/context-menu', () => ({
  WorkspaceContextMenu: vi.fn(({ children }: { children: ReactNode }) => (
    <div data-testid="workspace-context-menu">{children}</div>
  )),
}))

describe('MapPinContextMenuWrapper', () => {
  beforeEach(() => {
    vi.mocked(WorkspaceContextMenu).mockClear()
  })

  it('opens the workspace context menu with the pinned sidebar item', async () => {
    const map = createGameMapFixture()
    const item = createNoteFixture()
    const pin = createMapPinFixture({ item, map })

    render(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[pin]}
        pinOperations={{
          removeMapPin: vi.fn(),
          updateMapPinVisibility: vi.fn(),
        }}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <MapPinContextMenuWrapper pin={pin} position={{ x: 100, y: 200 }} onClose={vi.fn()} />
        <ActivePinProbe />
      </MapViewProvider>,
    )

    expect(screen.getByTestId('workspace-context-menu')).toBeInTheDocument()
    expect(lastWorkspaceContextMenuProps()).toMatchObject({
      viewContext: 'map-view',
      item,
    })
    await waitFor(() => {
      expect(screen.getByTestId('active-pin')).toHaveTextContent(pin.id)
    })
  })

  it('does not carry dialog-open state across pin context menus', async () => {
    const map = createGameMapFixture()
    const firstItem = createNoteFixture({ id: testId('note-1') })
    const secondItem = createNoteFixture({ id: testId('note-2') })
    const firstPin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-1'),
      item: firstItem,
      map,
    })
    const secondPin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-2'),
      item: secondItem,
      map,
    })
    const onClose = vi.fn()

    const { rerender } = render(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[firstPin, secondPin]}
        pinOperations={{
          removeMapPin: vi.fn(),
          updateMapPinVisibility: vi.fn(),
        }}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <MapPinContextMenuWrapper pin={firstPin} position={{ x: 100, y: 200 }} onClose={onClose} />
      </MapViewProvider>,
    )

    act(() => {
      lastWorkspaceContextMenuProps()?.onDialogOpen?.()
    })

    rerender(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[firstPin, secondPin]}
        pinOperations={{
          removeMapPin: vi.fn(),
          updateMapPinVisibility: vi.fn(),
        }}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <MapPinContextMenuWrapper pin={secondPin} position={{ x: 120, y: 220 }} onClose={onClose} />
      </MapViewProvider>,
    )

    act(() => {
      lastWorkspaceContextMenuProps()?.onClose?.()
    })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it('clears active pin state and closes once after a dialog closes', async () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture({ map })
    const onClose = vi.fn()

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
        <MapPinContextMenuWrapper pin={pin} position={{ x: 100, y: 200 }} onClose={onClose} />
        <ActivePinProbe />
      </MapViewProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-pin')).toHaveTextContent(pin.id)
    })
    act(() => {
      lastWorkspaceContextMenuProps()?.onDialogOpen?.()
      lastWorkspaceContextMenuProps()?.onDialogClose?.()
    })

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.getByTestId('active-pin')).toHaveTextContent('none')
  })
})

function ActivePinProbe() {
  const mapView = useMapView()
  return <div data-testid="active-pin">{mapView.activePin?.id ?? 'none'}</div>
}

function lastWorkspaceContextMenuProps() {
  return vi.mocked(WorkspaceContextMenu).mock.lastCall?.[0] as
    | ComponentProps<typeof WorkspaceContextMenu>
    | undefined
}
