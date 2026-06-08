import { describe, expect, it } from 'vitest'
import { createEmbedCanvasNode, createSidebarItemEmbedCanvasNode } from '../embed-node-creation'
import { testId } from '~/test/helpers/test-id'

describe('createEmbedCanvasNode', () => {
  it('creates empty, external, and sidebar-item embed target nodes', () => {
    expect(createEmbedCanvasNode({ kind: 'empty' }, { x: 0, y: 0 }).data).toEqual(
      expect.objectContaining({
        target: { kind: 'empty' },
      }),
    )

    expect(
      createEmbedCanvasNode(
        { kind: 'externalUrl', url: 'https://example.com/a.mp3', name: 'a.mp3' },
        { x: 0, y: 0 },
      ).data,
    ).toEqual(
      expect.objectContaining({
        target: { kind: 'externalUrl', url: 'https://example.com/a.mp3', name: 'a.mp3' },
      }),
    )

    expect(createSidebarItemEmbedCanvasNode(testId('item-1'), { x: 0, y: 0 }).data).toEqual(
      expect.objectContaining({
        target: { kind: 'sidebarItem', sidebarItemId: 'item-1' },
      }),
    )
  })
})
