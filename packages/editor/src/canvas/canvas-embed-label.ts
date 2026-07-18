import type { CanvasDocumentNode } from './document-contract'
import { presentExternalUrl } from '../resources/external-url-presentation'

export function canvasEmbedLabel(node: Extract<CanvasDocumentNode, { type: 'embed' }>) {
  const destination = node.data.destination
  if (!destination) return 'Empty embed'
  if (destination.kind === 'externalUrl') return presentExternalUrl(destination.url).title
  if (destination.kind === 'unresolved') return destination.rawTarget || 'Unresolved embed'
  return `${destination.target.kind} embed`
}
