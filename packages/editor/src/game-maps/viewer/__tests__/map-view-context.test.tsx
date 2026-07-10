import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { MapPinId } from '../../../../../../shared/common/ids'
import { MapViewProvider } from '../map-view-context'
import { useMapView, useMapViewOptional } from '../use-map-view'
import {
  createGameMapFixture,
  createMapPinFixture,
  createNoteFixture,
  testId,
} from './test-fixtures'

describe('MapViewProvider', () => {
  it('keeps active pin state scoped to each provider instance', () => {
    const firstMap = createGameMapFixture({ id: testId('map-1'), name: 'First Map' })
    const secondMap = createGameMapFixture({ id: testId('map-2'), name: 'Second Map' })
    const firstPin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-1'),
      item: createNoteFixture({ id: testId('note-1'), name: 'First Note' }),
      map: firstMap,
    })
    const secondPin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-2'),
      item: createNoteFixture({ id: testId('note-2'), name: 'Second Note' }),
      map: secondMap,
    })

    render(
      <>
        <MapViewProvider
          canEditMap
          canViewPinItem={() => true}
          map={firstMap}
          pins={[firstPin]}
          pinOperations={createPinOperations()}
          requestPinMove={vi.fn()}
          requestPinPlacement={vi.fn()}
        >
          <MapViewProbe label="first" pinId={firstPin.id} />
        </MapViewProvider>
        <MapViewProvider
          canEditMap
          canViewPinItem={() => true}
          map={secondMap}
          pins={[secondPin]}
          pinOperations={createPinOperations()}
          requestPinMove={vi.fn()}
          requestPinPlacement={vi.fn()}
        >
          <MapViewProbe label="second" pinId={secondPin.id} />
        </MapViewProvider>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activate first' }))

    expect(screen.getByTestId('first-active-pin')).toHaveTextContent('First Note')
    expect(screen.getByTestId('second-active-pin')).toHaveTextContent('No active pin')

    fireEvent.click(screen.getByRole('button', { name: 'Activate second' }))

    expect(screen.getByTestId('first-active-pin')).toHaveTextContent('First Note')
    expect(screen.getByTestId('second-active-pin')).toHaveTextContent('Second Note')
  })

  it('uses the current provider pins as the active-pin domain', () => {
    const map = createGameMapFixture({ id: testId('map-1'), name: 'Map' })
    const pin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-1'),
      item: createNoteFixture({ id: testId('note-1'), name: 'Note' }),
      map,
    })
    const pins = [pin]
    const { rerender } = render(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={pins}
        pinOperations={createPinOperations()}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <MapViewProbe label="map" pinId={pin.id} />
      </MapViewProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activate map' }))
    expect(screen.getByTestId('map-active-pin')).toHaveTextContent('Note')

    rerender(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[]}
        pinOperations={createPinOperations()}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <MapViewProbe label="map" pinId={pin.id} />
      </MapViewProvider>,
    )

    expect(screen.getByTestId('map-active-pin')).toHaveTextContent('No active pin')
  })

  it('returns null from optional consumers until an active map exists', () => {
    const map = createGameMapFixture({ id: testId('map-1'), name: 'Map' })
    const { rerender } = render(
      <MapViewProvider
        canEditMap={false}
        canViewPinItem={() => true}
        map={null}
        pins={[]}
        pinOperations={createPinOperations()}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <OptionalMapViewProbe />
      </MapViewProvider>,
    )

    expect(screen.getByTestId('optional-map-view')).toHaveTextContent('none')

    rerender(
      <MapViewProvider
        canEditMap
        canViewPinItem={() => true}
        map={map}
        pins={[]}
        pinOperations={createPinOperations()}
        requestPinMove={vi.fn()}
        requestPinPlacement={vi.fn()}
      >
        <OptionalMapViewProbe />
      </MapViewProvider>,
    )

    expect(screen.getByTestId('optional-map-view')).toHaveTextContent('Map')
  })

  it('keeps the context value stable when provider inputs do not change', () => {
    const map = createGameMapFixture({ id: testId('map-1'), name: 'Map' })
    const pin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-1'),
      item: createNoteFixture({ id: testId('note-1'), name: 'Note' }),
      map,
    })
    const pins = [pin]
    const pinOperations = createPinOperations()
    const canViewPinItem = () => true
    const requestPinMove = vi.fn()
    const requestPinPlacement = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MapViewProvider
        canEditMap
        canViewPinItem={canViewPinItem}
        map={map}
        pins={pins}
        pinOperations={pinOperations}
        requestPinMove={requestPinMove}
        requestPinPlacement={requestPinPlacement}
      >
        {children}
      </MapViewProvider>
    )

    const { result, rerender } = renderHook(() => useMapView(), { wrapper })
    const contextValue = result.current
    const pinRequests = result.current.pinRequests
    const setActivePinId = result.current.setActivePinId

    rerender()

    expect(result.current).toBe(contextValue)
    expect(result.current.pinRequests).toBe(pinRequests)
    expect(result.current.setActivePinId).toBe(setActivePinId)
  })
})

function MapViewProbe({ label, pinId }: { label: string; pinId: MapPinId }) {
  const mapView = useMapView()
  return (
    <div>
      <button type="button" onClick={() => mapView.setActivePinId(pinId)}>
        Activate {label}
      </button>
      <p data-testid={`${label}-active-pin`}>{mapView.activePin?.item?.name ?? 'No active pin'}</p>
    </div>
  )
}

function OptionalMapViewProbe() {
  const mapView = useMapViewOptional()
  return <p data-testid="optional-map-view">{mapView?.activeMap?.name ?? 'none'}</p>
}

function createPinOperations() {
  return {
    removeMapPin: vi.fn(),
    updateMapPinVisibility: vi.fn(),
  }
}
