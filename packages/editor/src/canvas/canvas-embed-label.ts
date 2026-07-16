import type { CanvasDocumentNode } from './document-contract'

export function canvasEmbedLabel(node: Extract<CanvasDocumentNode, { type: 'embed' }>) {
  const destination = node.data.destination
  if (!destination) return 'Empty embed'
  if (destination.kind === 'externalUrl') return destination.url
  if (destination.kind === 'unresolved') return destination.rawTarget || 'Unresolved embed'
  return `${destination.target.kind} embed`
}
