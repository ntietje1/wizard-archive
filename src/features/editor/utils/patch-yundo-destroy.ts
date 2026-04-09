import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { logger } from '~/shared/utils/logger'

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
  try {
    const yUndoPlugin = findYUndoPlugin(view)
    if (!yUndoPlugin || !yUndoPlugin.spec.view) return

    const undoState = yUndoPlugin.getState(view.state)
    const um = undoState?.undoManager
    if (!um) return

    const umAny = um as Record<string, any>

    if (typeof umAny.afterTransactionHandler !== 'function') {
      logger.warn('[patchYUndoPluginDestroy] afterTransactionHandler not found, skipping patch')
      return
    }

    // If the afterTransactionHandler was unregistered (by a prior destroy),
    // re-register it so the UndoManager tracks changes again.
    const handler = umAny.afterTransactionHandler
    const observers = um.doc._observers as Map<string, Set<any>> | undefined
    const afterTxSet = observers?.get?.('afterTransaction')
    if (!afterTxSet || !afterTxSet.has(handler)) {
      um.doc.on('afterTransaction', handler)
    }
    if (!um.trackedOrigins.has(um)) {
      um.trackedOrigins.add(um)
    }

    const originalViewFactory = yUndoPlugin.spec.view as (v: EditorView) => {
      destroy?: () => void
    }

    yUndoPlugin.spec.view = (editorView: EditorView) => {
      const currentUm = yUndoPlugin.getState(editorView.state)?.undoManager
      if (!currentUm) return originalViewFactory(editorView)

      const currentUmAny = currentUm as Record<string, any>

      if (typeof currentUmAny.afterTransactionHandler !== 'function') {
        return originalViewFactory(editorView)
      }

      if (currentUmAny.__yundo_saved) {
        const saved = currentUmAny.__yundo_saved
        if (saved.hasTrackedSelf) currentUm.trackedOrigins.add(currentUm)
        const savedHandler = currentUmAny.afterTransactionHandler
        if (savedHandler) {
          const obs = currentUm.doc._observers as Map<string, Set<any>> | undefined
          const txSet = obs?.get?.('afterTransaction')
          if (!txSet || !txSet.has(savedHandler)) {
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

    const pluginViews = (view as Record<string, any>).pluginViews as
      | Array<{ destroy?: () => void }>
      | undefined
    if (!pluginViews) {
      logger.warn('[patchYUndoPluginDestroy] pluginViews not found, skipping pluginView patch')
      return
    }

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
  } catch (err) {
    logger.warn('[patchYUndoPluginDestroy] Unexpected error, undo patch skipped:', err)
  }
}

/**
 * y-prosemirror's _typeChanged (Yjs→PM sync) runs inside the undo/redo
 * Yjs transaction, but _prosemirrorChanged (PM→Yjs sync) is deferred to
 * the next PM transaction because the binding mutex blocks it during
 * _typeChanged. By the time it runs, the undo transaction has committed,
 * so the PM→Yjs attribute sync becomes a separate tracked transaction
 * that clears the redo stack.
 *
 * Fix: after _typeChanged exits the mutex, immediately call
 * _prosemirrorChanged while still inside the undo's Yjs transaction.
 * Nested doc.transact calls merge into the parent transaction, so the
 * attribute sync uses the undo's origin and the UndoManager treats it
 * as part of the undo, not a new change.
 */
export function patchYSyncAfterTypeChanged(view: EditorView) {
  try {
    for (const p of view.state.plugins) {
      try {
        const s = p.getState(view.state)
        if (s && typeof s === 'object' && 'binding' in s && s.binding) {
          const binding = s.binding as Record<string, any>
          if (
            typeof binding._typeChanged !== 'function' ||
            typeof binding._prosemirrorChanged !== 'function' ||
            binding.__typeChangedPatched
          ) {
            break
          }
          binding.__typeChangedPatched = true

          const origTypeChanged = binding._typeChanged.bind(binding)
          binding._typeChanged = (events: Array<unknown>, transaction: Record<string, any>) => {
            origTypeChanged(events, transaction)
            if (binding.prosemirrorView) {
              binding.mux(() => {
                binding._prosemirrorChanged(binding.prosemirrorView.state.doc)
              })
            }
          }

          break
        }
      } catch {
        /* skip */
      }
    }
  } catch (err) {
    logger.warn('[patchYSyncAfterTypeChanged] Unexpected error, patch skipped:', err)
  }
}
