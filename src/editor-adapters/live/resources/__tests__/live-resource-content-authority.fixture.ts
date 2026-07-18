import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LiveResourceContentAuthority } from '../live-resource-content-authority'

export function createLiveResourceContentAuthorityFixture(editable = true) {
  const listeners = new Set<() => void>()
  let canEdit = editable
  const authority: LiveResourceContentAuthority = {
    canEdit: (_resourceId: ResourceId) => canEdit,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    authority,
    setCanEdit(nextEditable: boolean) {
      canEdit = nextEditable
      for (const listener of listeners) listener()
    },
  }
}
