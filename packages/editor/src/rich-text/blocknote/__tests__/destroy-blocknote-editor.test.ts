import { describe, expect, it, vi } from 'vite-plus/test'
import { destroyBlockNoteEditor } from '../destroy-blocknote-editor'

describe('destroyBlockNoteEditor', () => {
  it('destroys the underlying Tiptap editor when teardown is available', () => {
    const destroy = vi.fn()

    expect(destroyBlockNoteEditor({ _tiptapEditor: { destroy } })).toBe(true)
    expect(destroy).toHaveBeenCalledExactlyOnceWith()
  })

  it('reports unavailable teardown without throwing', () => {
    expect(destroyBlockNoteEditor({})).toBe(false)
    expect(destroyBlockNoteEditor({ _tiptapEditor: {} })).toBe(false)
  })
})
