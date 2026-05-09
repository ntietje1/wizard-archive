import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { getRestoreTargetParentId } from 'convex/sidebarItems/operations/operationTargets'
import { createFolder } from '~/test/factories/sidebar-item-factory'
import type { ActiveItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

describe('sidebar operation targets', () => {
  it('restores from a trash folder surface to the sidebar root', () => {
    const trashedFolder = createFolder({
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
    })
    const activeSurface: ActiveItemSurface = {
      surface: 'folder-view',
      parentId: trashedFolder._id,
      visibleItemIds: [],
    }

    expect(
      getRestoreTargetParentId(activeSurface, new Map([[trashedFolder._id, trashedFolder]])),
    ).toBeNull()
  })

  it('preserves an explicit active sidebar folder restore target', () => {
    const activeFolder = createFolder({
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      parentId: null,
    })

    expect(
      getRestoreTargetParentId(null, new Map([[activeFolder._id, activeFolder]]), activeFolder._id),
    ).toBe(activeFolder._id)
  })

  it('uses the active sidebar folder surface as the restore target', () => {
    const activeFolder = createFolder({
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      parentId: null,
    })
    const activeSurface: ActiveItemSurface = {
      surface: 'folder-view',
      parentId: activeFolder._id,
      visibleItemIds: [],
    }

    expect(
      getRestoreTargetParentId(activeSurface, new Map([[activeFolder._id, activeFolder]])),
    ).toBe(activeFolder._id)
  })

  it('falls back to root when the active folder surface is missing', () => {
    const missingFolder = createFolder({
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      parentId: null,
    })
    const activeSurface: ActiveItemSurface = {
      surface: 'folder-view',
      parentId: missingFolder._id,
      visibleItemIds: [],
    }

    expect(getRestoreTargetParentId(activeSurface, new Map())).toBeNull()
  })

  it('falls back to root without an active surface or explicit target', () => {
    expect(getRestoreTargetParentId(null, new Map())).toBeNull()
  })

  it('falls back to root when an explicit restore target is missing', () => {
    const missingFolder = createFolder({
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      parentId: null,
    })

    expect(getRestoreTargetParentId(null, new Map(), missingFolder._id)).toBeNull()
  })
})
