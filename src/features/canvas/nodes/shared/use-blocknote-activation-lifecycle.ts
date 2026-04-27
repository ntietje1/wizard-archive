import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type {
  RichEmbedActivationPayload,
  RichEmbedLifecycleController,
} from '../embed/use-rich-embed-lifecycle'
import { useRichEmbedLifecycle } from '../embed/use-rich-embed-lifecycle'
import { logger } from '~/shared/utils/logger'

export interface BlockNoteEditorWithMountedView {
  _tiptapEditor?: {
    view?: EditorView | null
  }
}

export function getMountedBlockNoteView(
  editor: BlockNoteEditorWithMountedView | null | undefined,
): EditorView | null {
  const view = editor?._tiptapEditor?.view

  // BlockNote does not expose mount readiness directly, so we gate on the connected ProseMirror view.
  if (!view?.dom?.isConnected) {
    return null
  }

  try {
    if (!(view as EditorView & { docView?: object | null }).docView) {
      return null
    }
  } catch {
    return null
  }

  return view
}

export function useBlockNoteActivationLifecycle<TEditor extends BlockNoteEditorWithMountedView>({
  lifecycle,
  editable,
  editor,
  isReady,
  onActivationErrorMessage,
  onActivated,
}: {
  lifecycle: RichEmbedLifecycleController
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

    return isReady ? isReady(editor) : true
  }

  const onActivate = (payload: RichEmbedActivationPayload | null) => {
    if (!editor) {
      return
    }

    const view = getMountedBlockNoteView(editor)
    if (!view) {
      return
    }

    const point = payload?.point
    if (point) {
      try {
        const pos = view.posAtCoords({ left: point.x, top: point.y })
        if (pos && pos.inside !== -1) {
          const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos.pos))
          view.dispatch(tr)
        }
      } catch (error) {
        logger.warn(onActivationErrorMessage, error)
      }
    }

    view.focus()
    onActivated?.()
  }

  useRichEmbedLifecycle({
    lifecycle,
    editable,
    isReady: isEditorReady,
    onActivate,
  })
}
