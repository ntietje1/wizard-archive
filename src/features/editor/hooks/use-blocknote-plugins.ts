import { useEffect, useRef } from 'react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
  runYjsHistoryCommand,
} from '~/features/editor/utils/patch-yundo-destroy'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useDisableAutolink } from '~/features/editor/hooks/useDisableAutolink'
import { useMdLinkExtension } from '~/features/editor/hooks/useMdLinkExtension'
import { useWikiLinkExtension } from '~/features/editor/hooks/useWikiLinkExtension'

export function useBlockNotePlugins({
  editor,
  editable,
  linkResolver,
}: {
  editor: CustomBlockNoteEditor
  editable: boolean
  linkResolver: LinkResolver
}) {
  const isViewerMode = !editable || linkResolver.isViewerMode
  useWikiLinkExtension(editor, linkResolver, isViewerMode)
  useMdLinkExtension(editor, linkResolver, isViewerMode)
  useDisableAutolink(editor)
  useYjsUndoPatches(editor)
  return useNoteYjsUndoShortcutPatch(editor, !isViewerMode)
}

function useYjsUndoPatches(editor: CustomBlockNoteEditor) {
  useEffect(() => {
    const view = editor._tiptapEditor.view
    patchYUndoPluginDestroy(view)
    patchYSyncAfterTypeChanged(view)
  }, [editor])
}

function useNoteYjsUndoShortcutPatch(editor: CustomBlockNoteEditor, editable: boolean) {
  const noteSurfaceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const surface = noteSurfaceRef.current
    if (!editable || !surface) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isHistoryShortcut(event) || !isEventInsideNoteSurface(event, editor, surface)) return
      event.preventDefault()
      event.stopPropagation()
      runYjsHistoryCommand(editor._tiptapEditor.view, getHistoryDirection(event))
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [editable, editor])

  return noteSurfaceRef
}

function isHistoryShortcut(event: globalThis.KeyboardEvent) {
  if (event.altKey || (!event.ctrlKey && !event.metaKey)) return false

  const key = event.key.toLowerCase()
  return key === 'z' || (event.ctrlKey && !event.metaKey && key === 'y')
}

function getHistoryDirection(event: globalThis.KeyboardEvent): 'undo' | 'redo' {
  const key = event.key.toLowerCase()
  if (key === 'y' || (key === 'z' && event.shiftKey)) return 'redo'
  return 'undo'
}

function isEventInsideNoteSurface(
  event: globalThis.KeyboardEvent,
  editor: CustomBlockNoteEditor,
  surface: HTMLElement,
) {
  if (editor._tiptapEditor.view.hasFocus()) return true

  const activeElement = surface.ownerDocument.activeElement
  if (
    activeElement instanceof Node &&
    (surface.contains(activeElement) || editor._tiptapEditor.view.dom.contains(activeElement))
  ) {
    return true
  }

  const target = event.target
  return (
    target instanceof Node &&
    (surface.contains(target) || editor._tiptapEditor.view.dom.contains(target))
  )
}
