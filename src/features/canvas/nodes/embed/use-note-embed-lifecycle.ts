import { TextSelection } from '@tiptap/pm/state'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import { useRichEmbedLifecycle } from './use-rich-embed-lifecycle'
import type {
  RichEmbedActivationPayload,
  RichEmbedLifecycleController,
} from './use-rich-embed-lifecycle'
import { logger } from '~/shared/utils/logger'

// getMountedView checks editor._tiptapEditor?.view and its internal docView so we only touch a fully mounted EditorView; this relies on TipTap 3.18.0 / ProseMirror 1.38.1 internals.
function getMountedView(editor: CustomBlockNoteEditor) {
  const view = editor._tiptapEditor?.view
  const docView = (view as unknown as { docView?: object | null })?.docView
  if (!view?.dom?.isConnected || !docView) {
    return null
  }
  return view
}

interface UseNoteEmbedLifecycleOptions {
  lifecycle: RichEmbedLifecycleController
  editable: boolean
  editor: CustomBlockNoteEditor | null
  doc: Doc | null
}

export function useNoteEmbedLifecycle({
  lifecycle,
  editable,
  editor,
  doc,
}: UseNoteEmbedLifecycleOptions) {
  const isReady = () => {
    return !!editor && !!doc && !!getMountedView(editor)
  }

  const onActivate = (payload: RichEmbedActivationPayload | null) => {
    if (!editor) return

    const view = getMountedView(editor)
    if (!view) return

    const point = payload?.point
    if (point) {
      try {
        const pos = view.posAtCoords({ left: point.x, top: point.y })
        if (pos && pos.inside !== -1) {
          const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos.pos))
          view.dispatch(tr)
        }
      } catch (error) {
        logger.warn(
          'useNoteEmbedLifecycle: failed to compute selection from posAtCoords/TextSelection.create',
          error,
        )
      }
    }

    view.focus()
  }

  useRichEmbedLifecycle({
    lifecycle,
    editable,
    isReady,
    onActivate,
  })
}
