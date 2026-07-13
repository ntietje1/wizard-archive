import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import type { SyntheticEvent } from 'react'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { useMapImageStatus } from '../use-map-image-status'

describe('useMapImageStatus', () => {
  it('ignores stale and mismatched image events', () => {
    const mapId = 'map-1' as SidebarItemId
    const { result, rerender } = renderHook(({ imageUrl }) => useMapImageStatus(mapId, imageUrl), {
      initialProps: { imageUrl: 'first.png' },
    })
    rerender({ imageUrl: 'second.png' })
    act(() => {
      result.current.handleImageLoad(imageEvent('first.png'))
      result.current.handleImageLoad(imageEvent('other.png'))
    })

    expect(result.current.imageLoaded).toBe(false)
    expect(result.current.imageError).toBe(false)

    act(() => {
      result.current.handleImageLoad(imageEvent('second.png'))
    })

    expect(result.current.imageLoaded).toBe(true)
    expect(result.current.imageError).toBe(false)
  })

  it('accepts only the active image error event', () => {
    const { result } = renderHook(() => useMapImageStatus('map-1' as SidebarItemId, 'active.png'))

    act(() => {
      result.current.handleImageError(imageEvent('stale.png'))
    })
    expect(result.current.imageError).toBe(false)

    act(() => {
      result.current.handleImageError(imageEvent('active.png'))
    })
    expect(result.current.imageError).toBe(true)
  })
})

function imageEvent(src: string): SyntheticEvent<HTMLImageElement> {
  return {
    currentTarget: {
      currentSrc: src,
      getAttribute: (name: string) => (name === 'src' ? src : null),
      src,
    },
  } as SyntheticEvent<HTMLImageElement>
}
