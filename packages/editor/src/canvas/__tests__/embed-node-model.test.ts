import { describe, expect, it } from 'vite-plus/test'
import { normalizeEmbedNodeData } from '../embed-node-model'

describe('normalizeEmbedNodeData', () => {
  it('rejects legacy sidebarItemId as canonical embed node data', () => {
    expect(normalizeEmbedNodeData({ sidebarItemId: 'item-1' }).target).toEqual({ kind: 'empty' })
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
