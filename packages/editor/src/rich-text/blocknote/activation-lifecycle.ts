import type { EditorView } from '@tiptap/pm/view'
import type {
  PendingRichEmbedActivationRef,
  RichEmbedActivationTarget,
} from '../deferred-activation'
import { useDeferredRichEmbedActivation } from '../deferred-activation'
import { focusEditorViewAtEnd, focusEditorViewAtNearestPoint } from './blocknote-editor-focus'

interface BlockNoteEditorWithMountedView {
  _tiptapEditor?: {
    view?: EditorView | null
  }
}

function getMountedBlockNoteView(
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
  const isEditorReady = () => {
    if (!editor || !getMountedBlockNoteView(editor)) {
      return false
    }

    if (!isReady) {
      return true
    }

    try {
      return isReady(editor)
    } catch {
      return false
    }
  }

  const onActivate = (target: RichEmbedActivationTarget) => {
    if (!editor) {
      return
    }

    const view = getMountedBlockNoteView(editor)
    if (!view) {
      return
    }

    const focused =
      target.kind === 'point'
        ? focusEditorViewAtNearestPoint(view, target.payload.point) || focusEditorViewAtEnd(view)
        : focusEditorViewAtEnd(view)
    finishActivation({ focused, onActivated, onActivationErrorMessage })
  }

  useDeferredRichEmbedActivation({
    pendingActivationRef,
    editable,
    isReady: isEditorReady,
    onActivate,
  })
}

function finishActivation({
  focused,
  onActivated,
  onActivationErrorMessage,
}: {
  focused: boolean
  onActivated: (() => void) | undefined
  onActivationErrorMessage: string
}) {
  if (!focused) {
    console.warn(onActivationErrorMessage)
  }
  onActivated?.()
}
