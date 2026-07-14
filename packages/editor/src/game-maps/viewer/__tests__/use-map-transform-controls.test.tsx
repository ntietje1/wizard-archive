import type { ResourceId } from '../../../resources/domain-id'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { useMapTransformControls } from '../use-map-transform-controls'
import { DEFAULT_MAP_TRANSFORM } from '../transform-state'
import { createMemoryMapTransformStore } from '../../../test/view-state-store-factory'

describe('useMapTransformControls', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the persisted transform for the current map id', () => {
    const transformStore = createMemoryMapTransformStore()
    const mapA = 'map-a' as ResourceId
    const mapB = 'map-b' as ResourceId
    transformStore.saveMapTransform(mapA, { scale: 1.5, positionX: 20, positionY: -4 })
    transformStore.saveMapTransform(mapB, { scale: 2, positionX: 80, positionY: 12 })

    const { result, rerender } = renderHook(
      ({ mapId }) =>
        useMapTransformControls({
          mapId,
          pinsContainerRef: { current: null },
          transformStore,
        }),
      { initialProps: { mapId: mapA } },
    )

    expect(result.current.savedTransform).toEqual({ scale: 1.5, positionX: 20, positionY: -4 })

    rerender({ mapId: mapB })

    expect(result.current.savedTransform).toEqual({ scale: 2, positionX: 80, positionY: 12 })
  })

  it('keeps reset as the final persisted transform when a debounced save was pending', () => {
    vi.useFakeTimers()
    const transformStore = createMemoryMapTransformStore()
    const mapId = 'map-1' as ResourceId
    const resetTransform = vi.fn()
    const { result, unmount } = renderHook(() =>
      useMapTransformControls({
        mapId,
        pinsContainerRef: { current: null },
        transformStore,
      }),
    )
    try {
      result.current.transformWrapperRef.current = { resetTransform } as never

      act(() => {
        result.current.handleTransformChange(null, { scale: 2, positionX: 40, positionY: 10 })
        result.current.handleResetTransform()
        vi.advanceTimersByTime(300)
      })

      expect(resetTransform).toHaveBeenCalledOnce()
      expect(transformStore.loadMapTransform(mapId)).toEqual(DEFAULT_MAP_TRANSFORM)
    } finally {
      unmount()
    }
  })

  it('flushes the latest transform before switching maps', () => {
    vi.useFakeTimers()
    const transformStore = createMemoryMapTransformStore()
    const mapA = 'map-a' as ResourceId
    const mapB = 'map-b' as ResourceId
    transformStore.saveMapTransform(mapB, { scale: 1.25, positionX: 8, positionY: 4 })
    const { result, rerender, unmount } = renderHook(
      ({ mapId }) =>
        useMapTransformControls({
          mapId,
          pinsContainerRef: { current: null },
          transformStore,
        }),
      { initialProps: { mapId: mapA } },
    )

    try {
      act(() => {
        result.current.handleTransformChange(null, { scale: 2, positionX: 40, positionY: 10 })
      })
      rerender({ mapId: mapB })
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.savedTransform).toEqual({ scale: 1.25, positionX: 8, positionY: 4 })
      expect(transformStore.loadMapTransform(mapA)).toEqual({
        scale: 2,
        positionX: 40,
        positionY: 10,
      })
    } finally {
      unmount()
    }
  })
})
