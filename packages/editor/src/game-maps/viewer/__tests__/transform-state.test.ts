import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { DEFAULT_MAP_TRANSFORM } from '../transform-state'
import { createMemoryMapTransformStore } from '../../../test/view-state-store-factory'

describe('map transform state', () => {
  it('stores map transforms by map id', () => {
    const store = createMemoryMapTransformStore()

    store.saveMapTransform('map-1' as SidebarItemId, {
      scale: 1.5,
      positionX: 24,
      positionY: -12,
    })

    expect(store.loadMapTransform('map-1' as SidebarItemId)).toEqual({
      scale: 1.5,
      positionX: 24,
      positionY: -12,
    })
    expect(store.loadMapTransform('map-2' as SidebarItemId)).toEqual(DEFAULT_MAP_TRANSFORM)
  })
})
