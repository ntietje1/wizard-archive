import { useCallback } from 'react'
import type { EditorView } from '@tiptap/pm/view'
import type {
  PendingRichEmbedActivationRef,
  RichEmbedActivationPayload,
} from '../embed/use-rich-embed-lifecycle'
import { useDeferredRichEmbedActivation } from '../embed/use-rich-embed-lifecycle'
import {
  focusEditorViewAtEnd,
  focusEditorViewAtNearestPoint,
} from '~/features/editor/utils/note-editor-focus'
import { logger } from '~/shared/utils/logger'

export interface BlockNoteEditorWithMountedView {
  _tiptapEditor?: {
    view?: EditorView | null
  }
}

export function getMountedBlockNoteView(
  editor: BlockNoteEditorWithMountedView | null | undefined,
): EditorView | null {
  let view: EditorView | null | undefined

  try {
    view = editor?._tiptapEditor?.view
  } catch {
    return null
  }

  // BlockNote does not expose mount readiness directly, so we gate on the connected ProseMirror view.
  try {
    if (!view?.dom?.isConnected) {
      return null
    }

    if (!(view as EditorView & { docView?: object | null }).docView) {
      return null
    }
  } catch {
    return null
  }

  return view
}

export function useBlockNoteActivationLifecycle<TEditor extends BlockNoteEditorWithMountedView>({
  pendingActivationRef,
  editable,
  editor,
  isReady,
  onActivationErrorMessage,
  onActivated,
}: {
  pendingActivationRef: PendingRichEmbedActivationRef
  editable: boolean
  editor: TEditor | null
  isReady?: (editor: TEditor) => boolean
  onActivationErrorMessage: string
  onActivated?: () => void
}) {
  const isEditorReady = useCallback(() => {
    if (!editor || !getMountedBlockNoteView(editor)) {
      return false
    }

    return isReady ? isReady(editor) : true
  }, [editor, isReady])

  const onActivate = useCallback(
    (payload: RichEmbedActivationPayload | null) => {
      if (!editor) {
        return
      }

      const view = getMountedBlockNoteView(editor)
      if (!view) {
        return
      }

      const point = payload?.point
      if (point) {
        const focused = focusEditorViewAtNearestPoint(view, point) || focusEditorViewAtEnd(view)
        if (!focused) {
          logger.warn(onActivationErrorMessage)
        }
        onActivated?.()
        return
      }

      const focused = focusEditorViewAtEnd(view)
      if (!focused) {
        logger.warn(onActivationErrorMessage)
      }
      onActivated?.()
    },
    [editor, onActivated, onActivationErrorMessage],
  )

  useDeferredRichEmbedActivation({
    pendingActivationRef,
    editable,
    isReady: isEditorReady,
    onActivate,
  })
}
