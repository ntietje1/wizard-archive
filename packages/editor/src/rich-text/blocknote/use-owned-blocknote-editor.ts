import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useOwnedBlockNoteEditor<TEditor>({
  createEditor,
  destroyEditor,
  identity,
  onEditorChange,
}: {
  createEditor: () => TEditor | null
  destroyEditor: (editor: TEditor) => void
  identity?: unknown
  onEditorChange?: (editor: TEditor | null) => void
}) {
  const [editor, setEditor] = useState<TEditor | null>(null)
  const createEditorRef = useRef(createEditor)
  const destroyEditorRef = useRef(destroyEditor)
  const editorRef = useRef<TEditor | null>(null)
  const onEditorChangeRef = useRef(onEditorChange)

  useLayoutEffect(() => {
    createEditorRef.current = createEditor
    destroyEditorRef.current = destroyEditor
    editorRef.current = editor
    onEditorChangeRef.current = onEditorChange
  }, [createEditor, destroyEditor, editor, onEditorChange])

  // Editor construction is keyed by identity; changing callbacks are read through refs.
  useEffect(() => {
    const nextEditor = createEditorRef.current()
    if (!nextEditor) {
      return
    }

    editorRef.current = nextEditor
    setEditor(nextEditor)
    onEditorChangeRef.current?.(nextEditor)

    return () => {
      const shouldClearEditor = editorRef.current === nextEditor

      try {
        destroyEditorRef.current(nextEditor)
      } catch {
        // BlockNote can throw while tearing down already-detached views; hook cleanup must remain local.
      } finally {
        if (shouldClearEditor) {
          editorRef.current = null
          setEditor(null)
          onEditorChangeRef.current?.(null)
        }
      }
    }
  }, [identity])

  return editor
}
