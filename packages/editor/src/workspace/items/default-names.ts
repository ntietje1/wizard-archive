import { assertResourceItemName, deduplicateName } from '../items'
import { RESOURCE_TYPES } from '../items-persistence-contract'
import type { ResourceName, ResourceKind } from '../resource-contract'

const defaultNameMap: Record<ResourceKind, ResourceName> = {
  [RESOURCE_TYPES.folders]: assertResourceItemName('Untitled Folder'),
  [RESOURCE_TYPES.notes]: assertResourceItemName('Untitled Note'),
  [RESOURCE_TYPES.gameMaps]: assertResourceItemName('Untitled Map'),
  [RESOURCE_TYPES.files]: assertResourceItemName('Untitled File'),
  [RESOURCE_TYPES.canvases]: assertResourceItemName('Untitled Canvas'),
}

export function findUniqueDefaultName(
  type: ResourceKind,
  siblings: Array<{ name: ResourceName }>,
): ResourceName {
  return assertResourceItemName(
    deduplicateName(
      defaultNameMap[type],
      siblings.map((s) => s.name),
    ),
  )
}
