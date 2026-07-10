import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { Doc } from '../../_generated/dataModel'

export function isYjsDocumentType(type: Doc<'sidebarItems'>['type']) {
  return type === RESOURCE_TYPES.notes || type === RESOURCE_TYPES.canvases
}
