import { describe, expect, it } from 'vite-plus/test'
import { canvasEmbedMediaLayoutUpdate } from '../canvas-embed-media-layout'
import type { CanvasDocumentNode } from '../document-contract'
import { generateDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

function embedNode(
  overrides: Partial<Extract<CanvasDocumentNode, { type: 'embed' }>> = {},
): Extract<CanvasDocumentNode, { type: 'embed' }> {
  return {
    id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
    type: 'embed',
    position: { x: 10, y: 20 },
    data: {},
    ...overrides,
  }
}

describe('canvas embed media layout', () => {
  it('records an intrinsic ratio and reshapes only the untouched default node', () => {
    const node = embedNode()
    expect(
      canvasEmbedMediaLayoutUpdate(node, {
        kind: 'intrinsicAspectRatio',
        aspectRatio: 16 / 9,
      }),
    ).toEqual({
      id: node.id,
      type: 'embed',
      data: { lockedAspectRatio: 16 / 9 },
      width: 320,
      height: 180,
    })
  })

  it('preserves a user-sized node while updating its resize invariant', () => {
    const node = embedNode({ width: 500, height: 300 })
    expect(
      canvasEmbedMediaLayoutUpdate(node, {
        kind: 'intrinsicAspectRatio',
        aspectRatio: 2,
      }),
    ).toEqual({
      id: node.id,
      type: 'embed',
      data: { lockedAspectRatio: 2 },
    })
  })

  it('clears the ratio and fixes audio to its native player height', () => {
    const node = embedNode({
      width: 500,
      height: 300,
      data: { lockedAspectRatio: 2 },
    })
    expect(canvasEmbedMediaLayoutUpdate(node, { kind: 'fixedHeight', height: 40 })).toEqual({
      id: node.id,
      type: 'embed',
      data: { lockedAspectRatio: undefined },
      width: 500,
      height: 40,
    })
  })
})
