import { Boxes, File, FileText, Folder, Map as MapIcon } from 'lucide-react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { ResourceKind } from '../resource-record'

export function resourceKindIcon(kind: ResourceKind) {
  switch (kind) {
    case 'note':
      return FileText
    case 'folder':
      return Folder
    case 'file':
      return File
    case 'map':
      return MapIcon
    case 'canvas':
      return Boxes
  }
}

export function resourcePresentationKey(resource: AuthorizedResourceSummary) {
  return `${resource.kind}:${resource.title}`
}

export function duplicateResourceKeys(resources: ReadonlyArray<AuthorizedResourceSummary>) {
  const counts = new Map<string, number>()
  for (const resource of resources) {
    const key = resourcePresentationKey(resource)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key))
}
