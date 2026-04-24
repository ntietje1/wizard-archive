import { useEffect, useRef, useState } from 'react'

export function useOwnedBlockNoteEditor<TEditor>({
  createEditor,
  destroyEditor,
  onEditorChange,
}: {
  createEditor: () => TEditor | null
  destroyEditor: (editor: TEditor) => void
  onEditorChange?: (editor: TEditor | null) => void
}) {
  const [editor, setEditor] = useState<TEditor | null>(null)
  const editorRef = useRef<TEditor | null>(null)
  const onEditorChangeRef = useRef(onEditorChange)

  editorRef.current = editor
  onEditorChangeRef.current = onEditorChange

  useEffect(() => {
    const nextEditor = createEditor()
    if (!nextEditor) {
      return
    }

    setEditor(nextEditor)
    onEditorChangeRef.current?.(nextEditor)

    return () => {
      const shouldClearEditor = editorRef.current === nextEditor

      try {
        destroyEditor(nextEditor)
      } finally {
        if (shouldClearEditor) {
          setEditor(null)
          onEditorChangeRef.current?.(null)
        }
      }
    }
  }, [createEditor, destroyEditor])

  return editor
}
