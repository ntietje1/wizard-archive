import type { AnyItem } from '../../workspace/items'
import { canViewResourceAndKnownAncestors } from './permission-resolution'
import type { EditorWorkspaceActor, ResourcePermissionContext } from './permission-resolution'

export function filterVisibleResourcesForActor({
  actor,
  getItemById,
  resources,
}: {
  actor: EditorWorkspaceActor | null
  getItemById: ResourcePermissionContext['getItemById']
  resources: Array<AnyItem>
}): Array<AnyItem> {
  if (actor?.kind === 'owner') return resources

  const permissionContext = {
    actor,
    getItemById,
  }
  return resources.filter((item) => canViewResourceAndKnownAncestors(item, permissionContext))
}
