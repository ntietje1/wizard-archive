type BlockNoteEditorLike = {
  _tiptapEditor?: {
    destroy?: () => void
  }
}

export function destroyBlockNoteEditor(editor: BlockNoteEditorLike) {
  if (typeof editor._tiptapEditor?.destroy === 'function') {
    editor._tiptapEditor.destroy()
    return true
  }

  return false
}
