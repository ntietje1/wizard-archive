import { RESOURCE_TYPES } from '../items-persistence-contract'
import type { ResourceKind } from '../resource-contract'
import { assertNever } from './utils/assert-never'

export function getSidebarItemTypeLabel(type: ResourceKind): string {
  switch (type) {
    case RESOURCE_TYPES.notes:
      return 'Note'
    case RESOURCE_TYPES.folders:
      return 'Folder'
    case RESOURCE_TYPES.gameMaps:
      return 'Map'
    case RESOURCE_TYPES.files:
      return 'File'
    case RESOURCE_TYPES.canvases:
      return 'Canvas'
    default:
      return assertNever(type, 'Unhandled sidebar item type')
  }
}
