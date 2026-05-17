import { describe, expect, it, vi } from 'vitest'
import { patchYSyncAfterTypeChanged, patchYUndoPluginDestroy } from '../patch-yundo-destroy'
import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

describe('patchYUndoPluginDestroy', () => {
  it('does not stack plugin view wrappers when applied repeatedly', () => {
    const undoManager = createUndoManager()
    const plugin = createYUndoPlugin(undoManager)
    const pluginViewDestroy = vi.fn()
    const view = createEditorView(plugin, { destroy: pluginViewDestroy })

    patchYUndoPluginDestroy(view as unknown as EditorView)
    patchYUndoPluginDestroy(view as unknown as EditorView)

    view.pluginViews[0]?.destroy?.()

    expect(pluginViewDestroy).toHaveBeenCalledTimes(1)
    expect(undoManager.__yundo_saved).toEqual({
      hasTrackedSelf: true,
      observers: undoManager._observers,
    })
  })

  it('does not stack future plugin view factory wrappers when applied repeatedly', () => {
    const undoManager = createUndoManager()
    const originalDestroy = vi.fn()
    const originalViewFactory = vi.fn(() => ({ destroy: originalDestroy }))
    const plugin = createYUndoPlugin(undoManager, originalViewFactory)
    const view = createEditorView(plugin)

    patchYUndoPluginDestroy(view as unknown as EditorView)
    patchYUndoPluginDestroy(view as unknown as EditorView)

    const nextView = plugin.spec.view?.(view as unknown as EditorView)
    nextView?.destroy?.()

    expect(originalViewFactory).toHaveBeenCalledTimes(1)
    expect(originalDestroy).toHaveBeenCalledTimes(1)
  })
})

describe('patchYSyncAfterTypeChanged', () => {
  it('does not let the forced Yjs sync replace the undo selection', () => {
    const selectionBeforeUndo = { anchor: 'before-undo' }
    const selectionAfterUndo = { anchor: 'after-undo' }
    const binding = {
      beforeTransactionSelection: selectionBeforeUndo,
      mux: (run: () => void) => run(),
      prosemirrorView: {
        state: {
          doc: {},
        },
      },
      _typeChanged: vi.fn(),
      _prosemirrorChanged: vi.fn(() => {
        binding.beforeTransactionSelection = selectionAfterUndo
      }),
    }
    const plugin = {
      getState: () => ({ binding }),
    } as unknown as Plugin
    const view = createEditorView(plugin)

    patchYSyncAfterTypeChanged(view as unknown as EditorView)
    binding._typeChanged([], {})

    expect(binding._prosemirrorChanged).toHaveBeenCalledOnce()
    expect(binding.beforeTransactionSelection).toBe(selectionBeforeUndo)
  })
})

function createUndoManager() {
  const afterTransactionHandler = vi.fn()
  const afterTransactionObservers = new Set<unknown>([afterTransactionHandler])
  const undoManager = {
    _observers: new Map(),
    afterTransactionHandler,
    doc: {
      _observers: new Map([['afterTransaction', afterTransactionObservers]]),
      on: vi.fn((eventName: 'afterTransaction', handler: unknown) => {
        undoManager.doc._observers.get(eventName)?.add(handler)
      }),
    },
    trackedOrigins: new Set<unknown>(),
  } as {
    _observers: Map<unknown, unknown>
    afterTransactionHandler: ReturnType<typeof vi.fn>
    doc: {
      _observers: Map<string, Set<unknown>>
      on: ReturnType<typeof vi.fn>
    }
    trackedOrigins: Set<unknown>
    __yundo_saved?: {
      hasTrackedSelf: boolean
      observers: unknown
    }
  }
  undoManager.trackedOrigins.add(undoManager)
  return undoManager
}

function createYUndoPlugin(
  undoManager: ReturnType<typeof createUndoManager>,
  viewFactory: NonNullable<Plugin['spec']['view']> = () => ({}),
) {
  const plugin = {
    getState: () => ({ undoManager }),
    spec: {
      view: viewFactory,
    },
  } as unknown as Plugin
  return plugin
}

function createEditorView(plugin: Plugin, pluginView: { destroy?: () => void } = {}) {
  return {
    pluginViews: [pluginView],
    state: {
      plugins: [plugin],
    },
  }
}
