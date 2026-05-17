import { AllSelection, NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { getRelativeSelection, relativePositionToAbsolutePosition } from 'y-prosemirror'
import { logger } from '~/shared/utils/logger'

const PATCHED_YUNDO_VIEW = Symbol('patchedYUndoPluginView')
const PATCHED_PLUGIN_VIEW_DESTROY = Symbol('patchedYUndoPluginViewDestroy')

type YUndoManagerLike = {
  doc: {
    _observers?: Map<string, Set<unknown>>
    on: (eventName: 'afterTransaction', handler: unknown) => void
  }
  trackedOrigins: Set<unknown>
}

type MutableYUndoManager = YUndoManagerLike &
  Record<string, unknown> & {
    afterTransactionHandler?: unknown
    __yundo_saved?: {
      hasTrackedSelf: boolean
      observers: unknown
    }
    _observers?: unknown
  }

type YUndoPluginView = {
  destroy?: (() => void) & { [PATCHED_PLUGIN_VIEW_DESTROY]?: true }
}

type YSyncBindingLike = Parameters<typeof getRelativeSelection>[0]

type RelativeSelectionBookmark = {
  binding: YSyncBindingLike
  selection: ReturnType<typeof getRelativeSelection>
}

export function runYjsHistoryCommand(view: EditorView, direction: 'undo' | 'redo') {
  const yUndoPlugin = findYUndoPlugin(view)
  const undoManager = yUndoPlugin?.getState(view.state)?.undoManager
  if (!undoManager) return

  const selectionBookmark = createRelativeSelectionBookmark(view)
  if (direction === 'redo') {
    undoManager.redo()
  } else {
    undoManager.undo()
  }
  if (selectionBookmark) {
    restoreSelectionBookmark(view, selectionBookmark)
    setTimeout(() => restoreSelectionBookmark(view, selectionBookmark), 0)
  }
}

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

function findYSyncBinding(view: EditorView): YSyncBindingLike | null {
  for (const plugin of view.state.plugins) {
    try {
      const state = plugin.getState(view.state)
      if (state && typeof state === 'object' && 'binding' in state && state.binding) {
        return state.binding as YSyncBindingLike
      }
    } catch {
      /* skip */
    }
  }

  return null
}

export function patchYUndoPluginDestroy(view: EditorView) {
  try {
    const yUndoPlugin = findYUndoPlugin(view)
    if (!yUndoPlugin || !yUndoPlugin.spec.view) return

    const undoState = yUndoPlugin.getState(view.state)
    const um = undoState?.undoManager
    if (!um) return

    const umAny = um as MutableYUndoManager

    if (typeof umAny.afterTransactionHandler !== 'function') {
      logger.warn('[patchYUndoPluginDestroy] afterTransactionHandler not found, skipping patch')
      return
    }

    // If the afterTransactionHandler was unregistered (by a prior destroy),
    // re-register it so the UndoManager tracks changes again.
    const handler = umAny.afterTransactionHandler
    const observers = um.doc._observers
    const afterTxSet = observers?.get?.('afterTransaction')
    if (!afterTxSet || !afterTxSet.has(handler)) {
      um.doc.on('afterTransaction', handler)
    }
    if (!um.trackedOrigins.has(um)) {
      um.trackedOrigins.add(um)
    }

    patchYUndoPluginViewFactory(yUndoPlugin)

    const pluginViews = (view as unknown as { pluginViews?: Array<YUndoPluginView> }).pluginViews
    if (!pluginViews) {
      logger.warn('[patchYUndoPluginDestroy] pluginViews not found, skipping pluginView patch')
      return
    }

    const pluginIndex = view.state.plugins.indexOf(yUndoPlugin)
    if (pluginIndex === -1 || !pluginViews[pluginIndex]) return

    patchExistingYUndoPluginView(pluginViews[pluginIndex], um as YUndoManagerLike, umAny)
  } catch (err) {
    logger.warn('[patchYUndoPluginDestroy] Unexpected error, undo patch skipped:', err)
  }
}

function patchExistingYUndoPluginView(
  existingPluginView: YUndoPluginView,
  um: YUndoManagerLike,
  umAny: MutableYUndoManager,
) {
  const originalDestroy = existingPluginView.destroy
  if (originalDestroy?.[PATCHED_PLUGIN_VIEW_DESTROY]) return

  const patchedDestroy = function patchedYUndoPluginViewDestroy() {
    saveUndoManager(um, umAny)
    originalDestroy?.call(existingPluginView)
  } as (() => void) & { [PATCHED_PLUGIN_VIEW_DESTROY]?: true }
  patchedDestroy[PATCHED_PLUGIN_VIEW_DESTROY] = true
  existingPluginView.destroy = patchedDestroy
}

function patchYUndoPluginViewFactory(yUndoPlugin: Plugin) {
  const originalViewFactory = yUndoPlugin.spec.view as
    | (((v: EditorView) => { destroy?: () => void }) & { [PATCHED_YUNDO_VIEW]?: true })
    | undefined
  if (!originalViewFactory || originalViewFactory[PATCHED_YUNDO_VIEW]) return

  const patchedViewFactory = ((editorView: EditorView) => {
    const currentUm = yUndoPlugin.getState(editorView.state)?.undoManager
    if (!currentUm) return originalViewFactory(editorView)

    const currentUmAny = currentUm as MutableYUndoManager

    if (typeof currentUmAny.afterTransactionHandler !== 'function') {
      return originalViewFactory(editorView)
    }

    restoreSavedUndoManager(currentUm, currentUmAny)

    const result = originalViewFactory(editorView)

    return {
      ...result,
      destroy: () => {
        saveUndoManager(currentUm, currentUmAny)
        result?.destroy?.()
      },
    }
  }) as typeof originalViewFactory

  patchedViewFactory[PATCHED_YUNDO_VIEW] = true
  yUndoPlugin.spec.view = patchedViewFactory
}

function saveUndoManager(um: YUndoManagerLike, umAny: MutableYUndoManager) {
  umAny.__yundo_saved = {
    hasTrackedSelf: um.trackedOrigins.has(um),
    observers: umAny._observers,
  }
}

function restoreSavedUndoManager(currentUm: YUndoManagerLike, currentUmAny: MutableYUndoManager) {
  if (!currentUmAny.__yundo_saved) return

  const saved = currentUmAny.__yundo_saved
  if (saved.hasTrackedSelf) currentUm.trackedOrigins.add(currentUm)
  const savedHandler = currentUmAny.afterTransactionHandler
  if (savedHandler) {
    const obs = currentUm.doc._observers
    const txSet = obs?.get?.('afterTransaction')
    if (!txSet || !txSet.has(savedHandler)) {
      currentUm.doc.on('afterTransaction', savedHandler)
    }
  }
  currentUmAny._observers = saved.observers
  delete currentUmAny.__yundo_saved
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
            const prosemirrorView = binding.prosemirrorView as EditorView | null
            if (prosemirrorView) {
              const beforeTransactionSelection = binding.beforeTransactionSelection
              try {
                binding.mux(() => {
                  binding._prosemirrorChanged(prosemirrorView.state.doc)
                })
              } finally {
                binding.beforeTransactionSelection = beforeTransactionSelection
              }
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

function createRelativeSelectionBookmark(view: EditorView): RelativeSelectionBookmark | null {
  if (view.state.selection.empty) return null

  const binding = findYSyncBinding(view)
  if (!binding) return null

  return {
    binding,
    selection: getRelativeSelection(binding, view.state),
  }
}

function restoreSelectionBookmark(view: EditorView, selectionBookmark: RelativeSelectionBookmark) {
  const selection = resolveRelativeSelectionBookmark(view, selectionBookmark)
  if (selection && !view.state.selection.eq(selection)) {
    view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false))
  }
}

function resolveRelativeSelectionBookmark(
  view: EditorView,
  { binding, selection }: RelativeSelectionBookmark,
) {
  if (selection.anchor === null || selection.head === null) return null

  if (selection.type === 'all') {
    return new AllSelection(view.state.doc)
  }

  const anchor = relativePositionToAbsolutePosition(
    binding.doc,
    binding.type,
    selection.anchor,
    binding.mapping,
  )
  if (anchor === null) return null

  if (selection.type === 'node') {
    return NodeSelection.create(view.state.doc, anchor)
  }

  const head = relativePositionToAbsolutePosition(
    binding.doc,
    binding.type,
    selection.head,
    binding.mapping,
  )
  if (head === null) return null

  return TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head))
}
