import type { MouseEvent } from 'react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'

export type ResourceContextMenuRequest = Readonly<{
  resource: AuthorizedResourceSummary
  x: number
  y: number
}>

export function resourceContextMenuRequest(
  event: MouseEvent<HTMLElement>,
  resource: AuthorizedResourceSummary,
): ResourceContextMenuRequest {
  event.preventDefault()
  return { resource, x: event.clientX, y: event.clientY }
}
