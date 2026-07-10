import { useContext } from 'react'
import { MapViewContext } from './map-view-context-value'
import type { MapViewContextType } from './map-view-context-value'

export function useMapView(): MapViewContextType {
  const result = useContext(MapViewContext)
  if (!result) {
    throw new Error('useMapView must be used within MapViewProvider')
  }
  return result
}

export function useMapViewOptional(): MapViewContextType | null {
  const result = useContext(MapViewContext)
  if (!result?.activeMap) return null
  return result
}
