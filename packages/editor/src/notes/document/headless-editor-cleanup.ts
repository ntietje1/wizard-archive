export function destroyHeadlessBlockNoteEditor(editor: {
  _tiptapEditor?: { destroy?: () => void } | null
}): void {
  try {
    // BlockNote's headless editor does not expose a public destroy method.
    const tiptapEditor = editor._tiptapEditor
    if (tiptapEditor && typeof tiptapEditor.destroy === 'function') {
      tiptapEditor.destroy()
    }
  } catch (error) {
    console.error('Failed to destroy tiptap editor in destroyHeadlessBlockNoteEditor', error)
  }
}
