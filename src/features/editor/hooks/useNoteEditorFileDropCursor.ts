import { useEffect } from 'react'
import { dropCursor } from '@tiptap/pm/dropcursor'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

interface TiptapEditorLike {
  view: EditorView | undefined
  registerPlugin: (
    plugin: Plugin,
    handlePlugins?: (newPlugin: Plugin, plugins: Array<Plugin>) => Array<Plugin>,
  ) => void
}

const registeredEditors = new WeakSet<TiptapEditorLike>()
const MAX_DROP_CURSOR_REGISTRATION_FRAMES = 120

export function useNoteEditorFileDropCursor(editor: CustomBlockNoteEditor, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    return registerNoteEditorDropCursorPlugin(editor._tiptapEditor)
  }, [editor, enabled])
}

function registerNoteEditorDropCursorPlugin(tiptapEditor: TiptapEditorLike | undefined) {
  if (!tiptapEditor || registeredEditors.has(tiptapEditor)) return undefined

  let cancelled = false
  let frameId: number | null = null
  let attempts = 0

  const registerWhenReady = () => {
    if (cancelled) return

    const view = getMountedEditorView(tiptapEditor)
    if (!view) {
      attempts += 1
      if (attempts >= MAX_DROP_CURSOR_REGISTRATION_FRAMES) {
        return
      }
      frameId = requestAnimationFrame(registerWhenReady)
      return
    }

    registeredEditors.add(tiptapEditor)
    const cursorPlugin = dropCursor({
      color: false,
      width: 2,
      class: 'note-editor-file-drop-cursor',
    }) as unknown as Plugin
    tiptapEditor.registerPlugin(cursorPlugin)
  }

  frameId = requestAnimationFrame(registerWhenReady)

  return () => {
    cancelled = true
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
    }
  }
}

function getMountedEditorView(tiptapEditor: TiptapEditorLike) {
  try {
    const view = tiptapEditor.view
    if (!view) return undefined
    return 'dom' in view && view.dom ? view : undefined
  } catch {
    return undefined
  }
}
