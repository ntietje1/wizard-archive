import type { CanvasNodeId, MapPinId, NoteBlockId, ResourceId } from './domain-id'

declare const safeHttpsUrlBrand: unique symbol

export type SafeHttpsUrl = string & { readonly [safeHttpsUrlBrand]: true }

export type CanonicalTarget =
  | { readonly kind: 'resource'; readonly resourceId: ResourceId }
  | {
      readonly kind: 'noteBlock'
      readonly resourceId: ResourceId
      readonly blockId: NoteBlockId
      readonly presentation: 'block' | 'heading'
    }
  | { readonly kind: 'mapPin'; readonly resourceId: ResourceId; readonly pinId: MapPinId }
  | {
      readonly kind: 'canvasNode'
      readonly resourceId: ResourceId
      readonly nodeId: CanvasNodeId
    }

export type AuthoredDestination =
  | { readonly kind: 'internal'; readonly target: CanonicalTarget }
  | { readonly kind: 'externalUrl'; readonly url: SafeHttpsUrl }
  | { readonly kind: 'unresolved'; readonly rawTarget: string }

export function parseSafeHttpsUrl(value: string): SafeHttpsUrl | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? (url.href as SafeHttpsUrl) : null
  } catch {
    return null
  }
}
