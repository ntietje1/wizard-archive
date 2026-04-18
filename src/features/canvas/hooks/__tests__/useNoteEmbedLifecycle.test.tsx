import { describe, expect, it } from 'vitest'
import { getMountedView } from '../useNoteEmbedLifecycle'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

describe('getMountedView', () => {
  it('returns the mounted TipTap view and guards the internal docView shape', () => {
    const view = {
      dom: { isConnected: true },
      docView: {},
    }
    const editor = {
      _tiptapEditor: {
        view,
      },
    } as unknown as CustomBlockNoteEditor

    expect(editor._tiptapEditor.view.dom.isConnected).toBe(true)
    expect('docView' in editor._tiptapEditor.view).toBe(true)
    expect(getMountedView(editor)).toBe(view)
  })
})
