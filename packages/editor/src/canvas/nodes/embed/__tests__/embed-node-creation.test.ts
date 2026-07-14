import { describe, expect, it } from 'vite-plus/test'
import { createEmbedCanvasNode, createResourceEmbedCanvasNode } from '../embed-node-creation'
import { testId } from '../../../../test/id'

describe('createEmbedCanvasNode', () => {
  it('creates empty, external, and sidebar-item embed target nodes', () => {
    const emptyNode = createEmbedCanvasNode({ kind: 'empty' }, { x: 0, y: 0 })
    const externalNode = createEmbedCanvasNode(
      { kind: 'externalUrl', url: 'https://example.com/a.mp3', name: 'a.mp3' },
      { x: 0, y: 0 },
    )
    const resourceNode = createResourceEmbedCanvasNode(testId('item-1'), { x: 0, y: 0 })

    expect(emptyNode).toMatchObject({ width: 320, height: 240 })
    expect(emptyNode.data).toEqual(
      expect.objectContaining({
        target: { kind: 'empty' },
      }),
    )

    expect(externalNode).toMatchObject({ width: 320, height: 240 })
    expect(externalNode.data).toEqual(
      expect.objectContaining({
        target: { kind: 'externalUrl', url: 'https://example.com/a.mp3', name: 'a.mp3' },
      }),
    )

    expect(resourceNode).toMatchObject({ width: 320, height: 240 })
    expect(resourceNode.data).toEqual(
      expect.objectContaining({
        target: { kind: 'resource', resourceId: 'item-1' },
      }),
    )
  })
})
