import { useEffect, useRef, useState } from 'react'

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

  createEditorRef.current = createEditor
  destroyEditorRef.current = destroyEditor
  editorRef.current = editor
  onEditorChangeRef.current = onEditorChange

  useEffect(() => {
    const nextEditor = createEditorRef.current()
    if (!nextEditor) {
      return
    }

    setEditor(nextEditor)
    onEditorChangeRef.current?.(nextEditor)

    return () => {
      const shouldClearEditor = editorRef.current === nextEditor

      try {
        destroyEditorRef.current(nextEditor)
      } finally {
        if (shouldClearEditor) {
          setEditor(null)
          onEditorChangeRef.current?.(null)
        }
      }
    }
  }, [identity])

  return editor
}
