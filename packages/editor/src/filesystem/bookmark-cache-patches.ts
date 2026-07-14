import type { ResourceId } from '../resources/domain-id'
import type { AnyItem } from '../workspace/items'
import type { ResourcePatch } from './patch-contract'

function bookmarkPatchState(patches: Array<ResourcePatch>) {
  const stateByItemId = new Map<ResourceId, boolean>()
  for (const patch of patches) {
    if (patch.type === 'setResourceBookmarkState') {
      stateByItemId.set(patch.itemId, patch.isBookmarked)
    }
  }
  return stateByItemId
}

export function applyBookmarkPatchState(items: Array<AnyItem>, patches: Array<ResourcePatch>) {
  const stateByItemId = bookmarkPatchState(patches)
  if (stateByItemId.size === 0) return items
  return items.map((item) => {
    const isBookmarked = stateByItemId.get(item.id)
    return isBookmarked === undefined ? item : { ...item, isBookmarked }
  })
}
