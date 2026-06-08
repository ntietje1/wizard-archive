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
        console.warn(
          `[useNoteEditorFileDropCursor] Drop cursor registration failed after ${attempts} attempts; editorId=${getEditorDebugId(tiptapEditor)} selector=.bn-editor`,
        )
        return
      }
      frameId = requestAnimationFrame(registerWhenReady)
      return
    }

    registeredEditors.add(tiptapEditor)
    installEmptyEmbedDropCursorGuard(view)
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

function installEmptyEmbedDropCursorGuard(view: EditorView) {
  const embedNodeSpec = view.state.schema.nodes.embed?.spec
  if (!embedNodeSpec) return

  const existingDisableDropCursor = embedNodeSpec.disableDropCursor
  embedNodeSpec.disableDropCursor = (editorView, position, event) => {
    if (isEmptyNoteEmbedDropTargetAtEvent(event, getEventDocument(event))) return true
    if (typeof existingDisableDropCursor === 'function') {
      return existingDisableDropCursor(editorView, position, event)
    }
    return existingDisableDropCursor === true
  }
}

function isEmptyNoteEmbedDropTargetAtEvent(event: DragEvent, eventDocument: Document) {
  return (
    isEmptyNoteEmbedDropTarget(event.target) ||
    isEmptyNoteEmbedDropTarget(getElementAtEventPoint(event, eventDocument))
  )
}

function isEmptyNoteEmbedDropTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('[data-note-embed-drop-target="true"][data-note-embed-target-kind="empty"]'),
  )
}

function getElementAtEventPoint(event: DragEvent, eventDocument: Document) {
  return eventDocument.elementFromPoint?.(event.clientX, event.clientY) ?? null
}

function getEventDocument(event: Event) {
  return event.target instanceof Node && event.target.ownerDocument
    ? event.target.ownerDocument
    : document
}

function getEditorDebugId(tiptapEditor: TiptapEditorLike) {
  try {
    const dom = tiptapEditor.view?.dom
    return dom?.id || dom?.getAttribute('data-editor-id') || 'unavailable'
  } catch {
    return 'unavailable'
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
