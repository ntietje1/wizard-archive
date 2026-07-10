import { describe, expect, it, vi } from 'vitest'
import { getClientErrorMessage } from '../../../shared/errors/client'

const decodedBlocks = vi.hoisted(() => [
  {
    id: 'private-block-id',
    type: 'unknown',
    props: { title: 'private title' },
    content: [{ type: 'text', text: 'private note text', styles: {} }],
    children: [],
  },
])

vi.mock('@wizard-archive/editor/notes/document-yjs', () => ({
  decodeNoteYjsUpdatesToBlocks: () => decodedBlocks,
}))

describe('yjsUpdatesToBlocks', () => {
  it('reports invalid decoded BlockNote output with a structural client error', async () => {
    const { yjsUpdatesToBlocks } = await import('../blocknoteNode')
    let thrown: unknown

    try {
      yjsUpdatesToBlocks([])
    } catch (error) {
      thrown = error
    }

    const message = getClientErrorMessage(thrown)
    expect(message).toContain('Invalid BlockNote output for fragment "document"')
    expect(message).toContain('array(length=1, objects=1')
    expect(message).toContain('Invalid discriminator value')
  })
})
