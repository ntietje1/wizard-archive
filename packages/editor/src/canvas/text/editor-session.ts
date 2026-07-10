import { useEffect, useRef } from 'react'
import type { PendingRichEmbedActivationRef } from '../../rich-text/deferred-activation'
import { cloneCanvasTextContent, snapshotCanvasTextContent } from './editor'
import { createCanvasTextBlockNoteEditor, observeCanvasTextChanges } from './blocknote-adapter'
import type { CanvasTextContent } from './editor'
import type { CanvasTextEditor } from './schema'
import { useBlockNoteActivationLifecycle } from '../../rich-text/blocknote/activation-lifecycle'
import { useOwnedBlockNoteEditor } from '../../rich-text/blocknote/use-owned-blocknote-editor'
import { destroyBlockNoteEditor } from '../../rich-text/blocknote/destroy-blocknote-editor'
import { useLocalScrollTop } from '../../rich-text/use-local-scroll-top'

export function useCanvasTextEditorSession({
  ariaLabel,
  content,
  enabled = true,
  editable,
  pendingActivationRef,
  onActivated,
  onPersistContent,
}: {
  ariaLabel: string
  content: CanvasTextContent
  enabled?: boolean
  editable: boolean
  pendingActivationRef: PendingRichEmbedActivationRef
  onActivated: () => void
  onPersistContent: (content: CanvasTextContent) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useLocalScrollTop(viewportRef)
  const contentKey = snapshotCanvasTextContent(content).serialized
  const persistedContentKeyRef = useRef(contentKey)
  const latestContentRef = useRef(content)
  const lastExternalContentKeyRef = useRef(contentKey)
  const pendingExitContentKeyRef = useRef<string | null>(null)
  const wasEditableRef = useRef(editable)

  latestContentRef.current = content

  const createEditor = () => {
    if (!enabled) {
      return null
    }

    try {
      return createCanvasTextBlockNoteEditor({
        ariaLabel,
        content: latestContentRef.current,
      })
    } catch (error) {
      console.error('Error creating BlockNoteEditor for canvas rich text node', {
        ariaLabel,
        error,
      })
      return null
    }
  }

  const destroyEditor = (editor: CanvasTextEditor) => {
    try {
      destroyBlockNoteEditor(editor)
    } catch (error) {
      console.error('Error destroying BlockNoteEditor for canvas rich text node', {
        ariaLabel,
        error,
      })
    }
  }

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

    viewport.scrollTop = scrollTopRef.current
  }, [editable, editor, scrollTopRef])

  useEffect(() => {
    if (!editor) {
      wasEditableRef.current = editable
      return
    }

    const wasEditable = wasEditableRef.current
    wasEditableRef.current = editable

    if (wasEditable && !editable) {
      const finalContent = cloneCanvasTextContent(editor.document)
      const finalContentKey = snapshotCanvasTextContent(finalContent).serialized

      persistedContentKeyRef.current = finalContentKey

      if (finalContentKey !== contentKey) {
        pendingExitContentKeyRef.current = finalContentKey
        onPersistContent(finalContent)
      } else {
        pendingExitContentKeyRef.current = null
        lastExternalContentKeyRef.current = finalContentKey
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
        return
      }

      if (contentKey === lastExternalContentKeyRef.current) {
        return
      }

      pendingExitContentKeyRef.current = null
    }

    if (contentKey === lastExternalContentKeyRef.current) {
      return
    }

    lastExternalContentKeyRef.current = contentKey

    const editorContentSnapshot = snapshotCanvasTextContent(editor.document)
    if (editorContentSnapshot.serialized === contentKey) {
      persistedContentKeyRef.current = contentKey
      return
    }

    persistedContentKeyRef.current = contentKey
    editor.replaceBlocks(editor.document, cloneCanvasTextContent(latestContentRef.current))
  }, [contentKey, editable, editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    return observeCanvasTextChanges(editor, (currentEditor) => {
      const nextContent = cloneCanvasTextContent(currentEditor.document)
      const nextKey = snapshotCanvasTextContent(nextContent).serialized
      if (nextKey === persistedContentKeyRef.current) {
        return
      }

      persistedContentKeyRef.current = nextKey
      onPersistContent(nextContent)
    })
  }, [editor, onPersistContent])

  return {
    editor,
    viewportRef,
  }
}
