import {
  deriveExternalEmbedName,
  parseEmbedTarget,
} from '../../../../../shared/embeds/embedTargets'
import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import type { ResourceId } from '../../workspace/resource-contract'
import type { SidebarItemId } from '../../../../../shared/common/ids'

export function externalEmbedTargetFromUrl(rawUrl: string): EmbedTarget | null {
  const url = rawUrl.trim()
  return parseEmbedTarget({
    kind: 'externalUrl',
    url,
    name: deriveExternalEmbedName(url),
  })
}

export function resourceEmbedTarget(resourceId: ResourceId): EmbedTarget {
  return { kind: 'resource', resourceId }
}

export function getSidebarItemIdFromDragData(
  data: Record<string | symbol, unknown>,
): SidebarItemId | null {
  const id = data.sidebarItemId
  // This payload is produced by app-owned drag sources. Sidebar item ids are opaque
  // strings, so the frontend can only reject missing or malformed payload shape.
  return typeof id === 'string' && id.length > 0 ? (id as SidebarItemId) : null
}
