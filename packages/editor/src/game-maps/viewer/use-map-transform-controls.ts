import type { ResourceId } from '../../resources/domain-id'
import { useEffect, useRef, useState } from 'react'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

import type { MapTransformState, MapTransformStore } from './transform-state'
import { DEFAULT_MAP_TRANSFORM } from './transform-state'

type PinScaleRef = {
  current: HTMLElement | null
}

function clearPendingTransformSave(
  timeoutRef: React.RefObject<ReturnType<typeof setTimeout> | null>,
) {
  if (!timeoutRef.current) return
  clearTimeout(timeoutRef.current)
  timeoutRef.current = null
}

function usePersistedMapTransformState(
  mapId: ResourceId,
  transformStore: MapTransformStore,
): [MapTransformState, (value: MapTransformState) => void] {
  const [transform, setTransform] = useState(() => transformStore.loadMapTransform(mapId))

  useEffect(() => {
    setTransform(transformStore.loadMapTransform(mapId))
  }, [mapId, transformStore])

  const persistTransform = (value: MapTransformState) => {
    setTransform(value)
    transformStore.saveMapTransform(mapId, value)
  }

  return [transform, persistTransform]
}

export function useMapTransformControls({
  mapId,
  pinsContainerRef,
  transformStore,
}: {
  mapId: ResourceId
  pinsContainerRef: PinScaleRef
  transformStore: MapTransformStore
}) {
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const [savedTransform, setSavedTransform] = usePersistedMapTransformState(mapId, transformStore)
  const transformDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTransformRef = useRef<MapTransformState | null>(null)
  const pendingTransformMapIdRef = useRef<ResourceId | null>(null)
  const previousMapIdRef = useRef(mapId)
  const currentMapIdRef = useRef(mapId)
  currentMapIdRef.current = mapId

  useEffect(() => {
    const timeoutRef = transformDebounceRef
    return () => {
      clearPendingTransformSave(timeoutRef)
    }
  }, [])

  useEffect(() => {
    if (pendingTransformMapIdRef.current === previousMapIdRef.current && lastTransformRef.current) {
      transformStore.saveMapTransform(previousMapIdRef.current, lastTransformRef.current)
    }
    clearPendingTransformSave(transformDebounceRef)
    previousMapIdRef.current = mapId
    pendingTransformMapIdRef.current = null
    lastTransformRef.current = null
  }, [mapId, transformStore])

  const handleTransformChange = (
    _: unknown,
    state: { scale: number; positionX: number; positionY: number },
  ) => {
    if (pinsContainerRef.current) {
      pinsContainerRef.current.style.setProperty('--pin-scale', String(1 / state.scale))
    }

    clearPendingTransformSave(transformDebounceRef)
    const targetMapId = mapId
    lastTransformRef.current = {
      scale: state.scale,
      positionX: state.positionX,
      positionY: state.positionY,
    }
    pendingTransformMapIdRef.current = targetMapId
    transformDebounceRef.current = setTimeout(() => {
      if (currentMapIdRef.current !== targetMapId) return
      setSavedTransform({
        scale: state.scale,
        positionX: state.positionX,
        positionY: state.positionY,
      })
    }, 300)
  }

  const handleZoomIn = () => {
    transformWrapperRef.current?.zoomIn()
  }

  const handleZoomOut = () => {
    transformWrapperRef.current?.zoomOut()
  }

  const handleResetTransform = () => {
    clearPendingTransformSave(transformDebounceRef)
    transformWrapperRef.current?.resetTransform()
    setSavedTransform(DEFAULT_MAP_TRANSFORM)
  }

  return {
    handleResetTransform,
    handleTransformChange,
    handleZoomIn,
    handleZoomOut,
    savedTransform,
    transformWrapperRef,
  }
}
