import { BlockNoteEditor } from '@blocknote/core'
import { useCallback, useEffect, useRef } from 'react'
import type { RichEmbedLifecycleController } from '../embed/use-rich-embed-lifecycle'
import {
  canvasRichTextEditorSchema,
  cloneCanvasRichTextContent,
  serializeCanvasRichTextContent,
} from './canvas-rich-text-editor'
import type { CanvasRichTextEditor, CanvasRichTextPartialBlock } from './canvas-rich-text-editor'
import { useBlockNoteActivationLifecycle } from './use-blocknote-activation-lifecycle'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { logger } from '~/shared/utils/logger'

export function useCanvasRichTextEditorSession({
  ariaLabel,
  content,
  editable,
  lifecycle,
  onActivated,
  onPersistContent,
}: {
  ariaLabel: string
  content: Array<CanvasRichTextPartialBlock>
  editable: boolean
  lifecycle: RichEmbedLifecycleController
  onActivated: () => void
  onPersistContent: (content: Array<CanvasRichTextPartialBlock>) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const contentKey = serializeCanvasRichTextContent(content)
  const persistedContentKeyRef = useRef(contentKey)
  const initialContentRef = useRef(content)
  const latestContentRef = useRef(content)
  const lastExternalContentKeyRef = useRef(contentKey)
  const pendingExitContentKeyRef = useRef<string | null>(null)
  const wasEditableRef = useRef(editable)

  latestContentRef.current = content

  const createEditor = useCallback(() => {
    try {
      return BlockNoteEditor.create({
        schema: canvasRichTextEditorSchema,
        initialContent: cloneCanvasRichTextContent(initialContentRef.current),
        placeholders: {
          emptyDocument: '',
          default: '',
          paragraph: '',
          heading: '',
          bulletListItem: '',
          numberedListItem: '',
          checkListItem: '',
          quote: '',
          codeBlock: '',
        },
        domAttributes: {
          editor: {
            'aria-label': ariaLabel,
            class: 'canvas-rich-text-editor',
          },
        },
      }) as CanvasRichTextEditor
    } catch (error) {
      console.error('Error creating BlockNoteEditor for canvas rich text node', {
        ariaLabel,
        error,
      })
      return null
    }
  }, [ariaLabel])

  const destroyEditor = useCallback(
    (editor: CanvasRichTextEditor) => {
      try {
        if ('destroy' in editor && typeof editor.destroy === 'function') {
          editor.destroy()
          return
        }

        logger.warn('Canvas rich text editor is falling back to BlockNote internal destroy API', {
          ariaLabel,
        })
        editor._tiptapEditor.destroy()
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
    lifecycle,
    editable,
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
      const finalContentKey = serializeCanvasRichTextContent(finalContent)

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

    const editorContentKey = serializeCanvasRichTextContent(editor.document)
    if (editorContentKey === contentKey) {
      persistedContentKeyRef.current = contentKey
      return
    }

    editor.replaceBlocks(editor.document, cloneCanvasRichTextContent(latestContentRef.current))
    persistedContentKeyRef.current = contentKey
  }, [contentKey, editable, editor])

  const handleChange = useCallback(
    (currentEditor: CanvasRichTextEditor) => {
      const nextContent = cloneCanvasRichTextContent(currentEditor.document)
      const nextKey = serializeCanvasRichTextContent(nextContent)
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

    return editor.onChange((currentEditor) => {
      handleChange(currentEditor as CanvasRichTextEditor)
    })
  }, [editor, handleChange])

  return {
    editor,
    viewportRef,
  }
}
