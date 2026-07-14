import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { getSidebarItemIdFromDragData, resourceEmbedTarget } from '../targets'

describe('embed target drop helpers', () => {
  it('keeps resource embed target ids source-neutral', () => {
    const sidebarItemId = 'item-a' as ResourceId

    expect(resourceEmbedTarget(sidebarItemId)).toEqual({
      kind: 'resource',
      resourceId: sidebarItemId,
    })
  })

  it('extracts only non-empty string sidebar item ids from drag data', () => {
    expect(getSidebarItemIdFromDragData({ sidebarItemId: 'item-a' })).toBe('item-a')
    expect(getSidebarItemIdFromDragData({ sidebarItemId: '' })).toBeNull()
    expect(getSidebarItemIdFromDragData({ sidebarItemId: 42 })).toBeNull()
    expect(getSidebarItemIdFromDragData({})).toBeNull()
  })
})
