import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/**
 * y-prosemirror's yUndoPlugin unconditionally destroys the UndoManager
 * when ProseMirror reconfigures plugins (which TipTap/BlockNote does
 * frequently). This kills undo history on every reconfiguration.
 *
 * This fix:
 * 1. Re-registers the destroyed UndoManager's afterTransactionHandler
 * 2. Patches the plugin's view factory to prevent future destructions
 *
 * Based on https://github.com/yjs/y-prosemirror/issues/114
 */

function findYUndoPlugin(view: EditorView): Plugin | undefined {
  return view.state.plugins.find((p) => {
    try {
      const state = p.getState(view.state)
      return state && typeof state === 'object' && 'undoManager' in state
    } catch {
      return false
    }
  })
}

export function patchYUndoPluginDestroy(view: EditorView) {
  const yUndoPlugin = findYUndoPlugin(view)
  if (!yUndoPlugin || !yUndoPlugin.spec.view) return

  const undoState = yUndoPlugin.getState(view.state)
  const um = undoState?.undoManager
  if (!um) return

  const umAny = um as Record<string, any>

  // If the afterTransactionHandler was unregistered (by a prior destroy),
  // re-register it so the UndoManager tracks changes again.
  const handler = umAny.afterTransactionHandler
  if (handler) {
    const observers = um.doc._observers as Map<string, Set<any>>
    const afterTxSet = observers?.get?.('afterTransaction')
    if (!afterTxSet || !afterTxSet.has(handler)) {
      um.doc.on('afterTransaction', handler)
    }
    // Also restore trackedOrigins self-reference if it was removed
    if (!um.trackedOrigins.has(um)) {
      um.trackedOrigins.add(um)
    }
  }

  // Patch the view factory to prevent future destructions
  const originalViewFactory = yUndoPlugin.spec.view as (v: EditorView) => {
    destroy?: () => void
  }

  yUndoPlugin.spec.view = (editorView: EditorView) => {
    const currentUm = yUndoPlugin.getState(editorView.state)?.undoManager
    if (!currentUm) return originalViewFactory(editorView)

    const currentUmAny = currentUm as Record<string, any>

    // Restore if previously saved
    if (currentUmAny.__yundo_saved) {
      const saved = currentUmAny.__yundo_saved
      if (saved.hasTrackedSelf) currentUm.trackedOrigins.add(currentUm)
      const savedHandler = currentUmAny.afterTransactionHandler
      if (savedHandler) {
        const observers = currentUm.doc._observers as
          | Map<string, Set<any>>
          | undefined
        const afterTxSet = observers?.get?.('afterTransaction')
        if (!afterTxSet || !afterTxSet.has(savedHandler)) {
          currentUm.doc.on('afterTransaction', savedHandler)
        }
      }
      currentUmAny._observers = saved.observers
      delete currentUmAny.__yundo_saved
    }

    const result = originalViewFactory(editorView)

    return {
      ...result,
      destroy: () => {
        currentUmAny.__yundo_saved = {
          hasTrackedSelf: currentUm.trackedOrigins.has(currentUm),
          observers: currentUmAny._observers,
        }
        result?.destroy?.()
      },
    }
  }

  // Also patch the existing pluginView's destroy handler
  const pluginViews = (view as Record<string, any>).pluginViews as Array<{
    destroy?: () => void
  }>
  if (!pluginViews) return

  const pluginIndex = view.state.plugins.indexOf(yUndoPlugin)
  if (pluginIndex === -1 || !pluginViews[pluginIndex]) return

  const existingPluginView = pluginViews[pluginIndex]
  const originalDestroy = existingPluginView.destroy

  existingPluginView.destroy = () => {
    umAny.__yundo_saved = {
      hasTrackedSelf: um.trackedOrigins.has(um),
      observers: umAny._observers,
    }
    originalDestroy?.call(existingPluginView)
  }
}
