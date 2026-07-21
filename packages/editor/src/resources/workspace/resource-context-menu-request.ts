import type { MouseEvent } from 'react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'

export type ResourceContextMenuRequest = Readonly<{
  origin: 'sidebar' | 'topbar' | 'workspace'
  resource: AuthorizedResourceSummary
  x: number
  y: number
}>

export function resourceContextMenuRequest(
  event: MouseEvent<HTMLElement>,
  resource: AuthorizedResourceSummary,
  origin: ResourceContextMenuRequest['origin'],
): ResourceContextMenuRequest {
  event.preventDefault()
  return { origin, resource, x: event.clientX, y: event.clientY }
}
