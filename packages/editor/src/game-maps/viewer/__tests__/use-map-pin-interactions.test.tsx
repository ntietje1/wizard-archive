import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { toast } from 'sonner'
import type { MapItemWithContent, MapPinWithItem } from '../../../game-maps/item-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { useMapPinInteractions } from '../use-map-pin-interactions'
import type { MapPinsCreateResult } from '../../session-contract'
import type { ResourceOperationResult } from '../../../filesystem/transaction-contract'
import {
  completedMapPinUpdate,
  completedMapPinsCreate,
  createGameMapFixture as createSharedGameMapFixture,
  createMapPinFixture as createSharedMapPinFixture,
} from './test-fixtures'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

describe('useMapPinInteractions', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.info).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('submits a pending pin placement once while creation is in flight', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const createMapPins = vi.fn(() => new Promise<MapPinsCreateResult>(() => undefined))

    render(<MapPinInteractionHarness map={map} pin={pin} createMapPins={createMapPins} />)
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Place note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(createMapPins).toHaveBeenCalledOnce()
  })

  it('keeps pin placement pending until the user clicks inside the map image', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const createMapPins = vi.fn().mockResolvedValue(completedMapPinsCreate(map.id, []))

    render(<MapPinInteractionHarness map={map} pin={pin} createMapPins={createMapPins} />)
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Place note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 260,
      clientY: 10,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(createMapPins).toHaveBeenCalledExactlyOnceWith({
      mapId: map.id,
      pins: [{ itemId: pin.itemId, layerId: null, x: 50, y: 25 }],
    })
  })

  it('exits placement mode when dragging a pin starts', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const createMapPins = vi.fn().mockResolvedValue(completedMapPinsCreate(map.id, []))

    render(<MapPinInteractionHarness map={map} pin={pin} createMapPins={createMapPins} />)
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Place note' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Note' }), { pointerId: 1 })
    expect(screen.getByTestId('map-cursor')).toHaveAttribute('data-cursor', 'grabbing')

    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })
    expect(createMapPins).not.toHaveBeenCalled()
  })

  it('uses the latest requested pin action for the next map activation', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const operations: Array<'create' | 'move'> = []
    const createMapPins = vi.fn().mockImplementation(() => {
      operations.push('create')
      return Promise.resolve(completedMapPinsCreate(map.id, []))
    })
    const updateMapPin = vi.fn().mockImplementation(() => {
      operations.push('move')
      return Promise.resolve(completedMapPinUpdate())
    })

    render(
      <MapPinInteractionHarness
        map={map}
        pin={pin}
        createMapPins={createMapPins}
        updateMapPin={updateMapPin}
      />,
    )
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Place note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move pin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(updateMapPin).toHaveBeenCalledExactlyOnceWith({
      mapId: map.id,
      mapPinId: pin.id,
      x: 50,
      y: 25,
    })
    expect(operations).toEqual(['move'])
  })

  it('submits a pending pin move once while the update is in flight', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const updateMapPin = vi.fn(() => new Promise<ResourceOperationResult>(() => undefined))

    render(<MapPinInteractionHarness map={map} pin={pin} updateMapPin={updateMapPin} />)
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Move pin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(updateMapPin).toHaveBeenCalledOnce()
  })

  it('clears pending pin placement when the active map changes', () => {
    const firstMap = createGameMapFixture('map-1' as SidebarItemId)
    const secondMap = createGameMapFixture('map-2' as SidebarItemId)
    const pin = createMapPinFixture(firstMap)
    const createMapPins = vi.fn().mockResolvedValue(completedMapPinsCreate(firstMap.id, []))

    const view = render(
      <MapPinInteractionHarness map={firstMap} pin={pin} createMapPins={createMapPins} />,
    )
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Place note' }))
    view.rerender(
      <MapPinInteractionHarness map={secondMap} pin={pin} createMapPins={createMapPins} />,
    )
    setImageBounds()
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(createMapPins).not.toHaveBeenCalled()
  })

  it('clears pending pin move when the active map changes', () => {
    const firstMap = createGameMapFixture('map-1' as SidebarItemId)
    const secondMap = createGameMapFixture('map-2' as SidebarItemId)
    const pin = createMapPinFixture(firstMap)
    const updateMapPin = vi.fn().mockResolvedValue(completedMapPinUpdate())

    const view = render(
      <MapPinInteractionHarness map={firstMap} pin={pin} updateMapPin={updateMapPin} />,
    )
    setImageBounds()

    fireEvent.click(screen.getByRole('button', { name: 'Move pin' }))
    view.rerender(
      <MapPinInteractionHarness map={secondMap} pin={pin} updateMapPin={updateMapPin} />,
    )
    setImageBounds()
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(updateMapPin).not.toHaveBeenCalled()
  })

  it('reports move-specific feedback when map position cannot be resolved', () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)

    render(<MapPinInteractionHarness map={map} pin={pin} />)

    fireEvent.click(screen.getByRole('button', { name: 'Move pin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Map canvas' }), {
      clientX: 100,
      clientY: 25,
    })

    expect(toast.error).toHaveBeenCalledExactlyOnceWith('No image loaded - cannot move pin')
  })

  it('commits the dragged pin position from the matching touch pointer session', async () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const updateMapPin = vi.fn().mockResolvedValue(completedMapPinUpdate())

    render(<MapPinInteractionHarness map={map} pin={pin} updateMapPin={updateMapPin} />)

    setImageBounds()
    const pinButton = screen.getByRole('button', { name: 'Note' })

    fireEvent.pointerDown(pinButton, {
      button: 0,
      pointerId: 17,
      pointerType: 'touch',
    })
    act(() => {
      window.dispatchEvent(
        createPointerEvent('pointermove', {
          clientX: 100,
          clientY: 25,
          pointerId: 99,
          pointerType: 'touch',
        }),
      )
      window.dispatchEvent(
        createPointerEvent('pointerup', {
          clientX: 100,
          clientY: 25,
          pointerId: 99,
          pointerType: 'touch',
        }),
      )
      window.dispatchEvent(
        createPointerEvent('pointermove', {
          clientX: 100,
          clientY: 25,
          pointerId: 17,
          pointerType: 'touch',
        }),
      )
      window.dispatchEvent(
        createPointerEvent('pointerup', {
          clientX: 100,
          clientY: 25,
          pointerId: 17,
          pointerType: 'touch',
        }),
      )
    })

    await waitFor(() => {
      expect(updateMapPin).toHaveBeenCalledExactlyOnceWith({
        mapId: map.id,
        mapPinId: pin.id,
        x: 50,
        y: 25,
      })
    })
  })

  it('opens the pin item when a pointer session finishes without moving', async () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const openItem = vi.fn().mockResolvedValue(undefined)
    const updateMapPin = vi.fn().mockResolvedValue(completedMapPinUpdate())

    render(
      <MapPinInteractionHarness
        map={map}
        pin={pin}
        openItem={openItem}
        updateMapPin={updateMapPin}
      />,
    )

    const pinButton = screen.getByRole('button', { name: 'Note' })

    fireEvent.pointerDown(pinButton, {
      button: 0,
      pointerId: 17,
      pointerType: 'touch',
    })
    act(() => {
      window.dispatchEvent(
        createPointerEvent('pointerup', {
          clientX: 100,
          clientY: 25,
          pointerId: 17,
          pointerType: 'touch',
        }),
      )
    })
    fireEvent.click(pinButton)

    expect(updateMapPin).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(openItem).toHaveBeenCalledExactlyOnceWith(pin.itemId)
    })
  })

  it('restores the pin element to its persisted position when dragging fails to save', async () => {
    const map = createGameMapFixture()
    const pin = createMapPinFixture(map)
    const updateMapPin = vi.fn().mockRejectedValue(new Error('save failed'))

    render(<MapPinInteractionHarness map={map} pin={pin} updateMapPin={updateMapPin} />)
    setImageBounds()

    const pinButton = screen.getByRole('button', { name: 'Note' })

    fireEvent.pointerDown(pinButton, {
      button: 0,
      pointerId: 17,
      pointerType: 'touch',
    })
    act(() => {
      window.dispatchEvent(
        createPointerEvent('pointermove', {
          clientX: 100,
          clientY: 25,
          pointerId: 17,
          pointerType: 'touch',
        }),
      )
      window.dispatchEvent(
        createPointerEvent('pointerup', {
          clientX: 100,
          clientY: 25,
          pointerId: 17,
          pointerType: 'touch',
        }),
      )
    })

    await waitFor(() => {
      expect(updateMapPin).toHaveBeenCalledOnce()
    })
    expect(pinButton).toHaveStyle({ left: '25%', top: '50%' })
  })
})

function MapPinInteractionHarness({
  createMapPins = vi.fn().mockResolvedValue(completedMapPinsCreate('map-1' as SidebarItemId, [])),
  map,
  openItem = vi.fn().mockResolvedValue(undefined),
  pin,
  updateMapPin = vi.fn().mockResolvedValue(completedMapPinUpdate()),
}: {
  createMapPins?: (input: {
    mapId: MapItemWithContent['id']
    pins: Array<{ itemId: SidebarItemId; layerId?: string | null; x: number; y: number }>
  }) => Promise<MapPinsCreateResult>
  map: MapItemWithContent
  openItem?: (itemId: SidebarItemId) => Promise<void>
  pin: MapPinWithItem
  updateMapPin?: (input: {
    mapPinId: MapPinWithItem['id']
    x: number
    y: number
  }) => Promise<ResourceOperationResult>
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  const pinsContainerRef = useRef<HTMLDivElement>(null)
  const interactions = useMapPinInteractions({
    canEditMap: true,
    imageError: false,
    imageRef,
    map,
    pinsContainerRef,
    source: {
      canViewItem: () => true,
      createMapPins,
      openItem,
      updateMapPin,
    },
  })

  return (
    <>
      <img ref={imageRef} alt="Map" />
      <button
        type="button"
        aria-label="Place note"
        onClick={() => interactions.requestPinPlacement({ itemIds: [pin.itemId] })}
      />
      <button
        type="button"
        aria-label="Move pin"
        onClick={() => interactions.requestPinMove({ pinId: pin.id })}
      />
      <button
        type="button"
        aria-label="Map canvas"
        data-testid="map-cursor"
        data-cursor={interactions.mapCursor}
        onClick={(event) => interactions.handleMapClick(event)}
      />
      <div ref={pinsContainerRef}>
        <button
          type="button"
          data-pin-id={pin.id}
          aria-label="Note"
          onClick={(event) => interactions.handlePinClick(event, pin)}
          onPointerDown={(event) => interactions.handlePinDragStart(event, pin)}
        />
      </div>
    </>
  )
}

function createGameMapFixture(id = 'map-1' as SidebarItemId): MapItemWithContent {
  return createSharedGameMapFixture({ id, imageUrl: 'map.png' })
}

function createMapPinFixture(map: MapItemWithContent): MapPinWithItem {
  return createSharedMapPinFixture({ map })
}

function setImageBounds() {
  const image = screen.getByRole('img', { name: 'Map' })
  image.getBoundingClientRect = () =>
    ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

function createPointerEvent(
  type: string,
  init: Partial<PointerEvent> & Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId'>,
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.assign(event, {
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: init.clientX,
    clientY: init.clientY,
    pointerId: init.pointerId,
    pointerType: init.pointerType ?? 'mouse',
  })
  return event
}
