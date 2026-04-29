import { useCallback, useEffect, useRef } from 'react'
import type { PendingRichEmbedActivationRef } from '../embed/use-rich-embed-lifecycle'
import {
  cloneCanvasRichTextContent,
  snapshotCanvasRichTextContent,
} from './canvas-rich-text-editor'
import type { CanvasRichTextContent, CanvasRichTextEditor } from './canvas-rich-text-editor'
import {
  createCanvasRichTextBlockNoteEditor,
  observeCanvasRichTextChanges,
} from './canvas-rich-text-blocknote-adapter'
import { useBlockNoteActivationLifecycle } from './use-blocknote-activation-lifecycle'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'

export function useCanvasRichTextEditorSession({
  ariaLabel,
  content,
  enabled = true,
  editable,
  pendingActivationRef,
  onActivated,
  onPersistContent,
}: {
  ariaLabel: string
  content: CanvasRichTextContent
  enabled?: boolean
  editable: boolean
  pendingActivationRef: PendingRichEmbedActivationRef
  onActivated: () => void
  onPersistContent: (content: CanvasRichTextContent) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const contentKey = snapshotCanvasRichTextContent(content).serialized
  const persistedContentKeyRef = useRef(contentKey)
  const initialContentRef = useRef(content)
  const latestContentRef = useRef(content)
  const lastExternalContentKeyRef = useRef(contentKey)
  const pendingExitContentKeyRef = useRef<string | null>(null)
  const wasEditableRef = useRef(editable)

  latestContentRef.current = content

  const createEditor = useCallback(() => {
    if (!enabled) {
      return null
    }

    try {
      return createCanvasRichTextBlockNoteEditor({
        ariaLabel,
        content: initialContentRef.current,
      })
    } catch (error) {
      console.error('Error creating BlockNoteEditor for canvas rich text node', {
        ariaLabel,
        error,
      })
      return null
    }
  }, [ariaLabel, enabled])

  const destroyEditor = useCallback(
    (editor: CanvasRichTextEditor) => {
      try {
        destroyBlockNoteEditor(editor)
      } catch (error) {
        console.error('Error destroying BlockNoteEditor for canvas rich text node', {
          ariaLabel,
          error,
        })
      }
    },
    [ariaLabel],
  )

  const editor = useOwnedBlockNoteEditor({
    createEditor,
    destroyEditor,
  })

  useBlockNoteActivationLifecycle({
    pendingActivationRef,
    editable: enabled && editable,
    editor,
    onActivationErrorMessage:
      'Canvas rich text node failed to compute selection from pointer position',
    onActivated,
  })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    viewport.scrollTop = scrollTopRef.current
  }, [editable, editor])

  useEffect(() => {
    if (!editor) {
      wasEditableRef.current = editable
      return
    }

    const wasEditable = wasEditableRef.current
    wasEditableRef.current = editable

    if (wasEditable && !editable) {
      const finalContent = cloneCanvasRichTextContent(editor.document)
      const finalContentKey = snapshotCanvasRichTextContent(finalContent).serialized

      persistedContentKeyRef.current = finalContentKey
      lastExternalContentKeyRef.current = finalContentKey

      if (finalContentKey !== contentKey) {
        pendingExitContentKeyRef.current = finalContentKey
        onPersistContent(finalContent)
      } else {
        pendingExitContentKeyRef.current = null
      }
    }
  }, [contentKey, editable, editor, onPersistContent])

  useEffect(() => {
    if (!editor) {
      return
    }

    if (editable) {
      pendingExitContentKeyRef.current = null
      lastExternalContentKeyRef.current = contentKey
      return
    }

    const pendingExitContentKey = pendingExitContentKeyRef.current
    if (pendingExitContentKey) {
      if (contentKey === pendingExitContentKey) {
        pendingExitContentKeyRef.current = null
        lastExternalContentKeyRef.current = contentKey
      }
      return
    }

    if (contentKey === lastExternalContentKeyRef.current) {
      return
    }

    lastExternalContentKeyRef.current = contentKey

    const editorContentSnapshot = snapshotCanvasRichTextContent(editor.document)
    if (editorContentSnapshot.serialized === contentKey) {
      persistedContentKeyRef.current = contentKey
      return
    }

    editor.replaceBlocks(editor.document, cloneCanvasRichTextContent(latestContentRef.current))
    persistedContentKeyRef.current = contentKey
  }, [contentKey, editable, editor])

  const handleChange = useCallback(
    (currentEditor: CanvasRichTextEditor) => {
      const nextContent = cloneCanvasRichTextContent(currentEditor.document)
      const nextKey = snapshotCanvasRichTextContent(nextContent).serialized
      if (nextKey === persistedContentKeyRef.current) {
        return
      }

      persistedContentKeyRef.current = nextKey
      onPersistContent(nextContent)
    },
    [onPersistContent],
  )

  useEffect(() => {
    if (!editor) {
      return
    }

    return observeCanvasRichTextChanges(editor, handleChange)
  }, [editor, handleChange])

  return {
    editor,
    viewportRef,
  }
}
