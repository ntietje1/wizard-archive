import { describe, expect, it } from 'vitest'
import { normalizeEmbedNodeData } from '../embed-node-data'

describe('normalizeEmbedNodeData', () => {
  it('normalizes legacy sidebarItemId to a sidebar item target', () => {
    expect(normalizeEmbedNodeData({ sidebarItemId: 'item-1' as never }).target).toEqual({
      kind: 'sidebarItem',
      sidebarItemId: 'item-1',
    })
  })

  it('normalizes missing target to empty', () => {
    expect(normalizeEmbedNodeData({}).target).toEqual({ kind: 'empty' })
  })

  it('preserves external URL targets', () => {
    expect(
      normalizeEmbedNodeData({
        target: { kind: 'externalUrl', url: 'https://example.com/a.pdf', name: 'a.pdf' },
      }).target,
    ).toEqual({ kind: 'externalUrl', url: 'https://example.com/a.pdf', name: 'a.pdf' })
  })
})
