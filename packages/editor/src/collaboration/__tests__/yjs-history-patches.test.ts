import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
  runYjsHistoryCommand,
} from '../yjs-history-patches'
import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

const getRelativeSelectionMock = vi.hoisted(() => vi.fn())

vi.mock('y-prosemirror', () => ({
  getRelativeSelection: getRelativeSelectionMock,
  relativePositionToAbsolutePosition: vi.fn(() => null),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('patchYUndoPluginDestroy', () => {
  it('applies one plugin view wrapper when patched repeatedly', () => {
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

  it('patches the yUndo plugin view when earlier plugins have no view', () => {
    const undoManager = createUndoManager()
    const pluginBeforeYUndo = { getState: () => null, spec: {} } as unknown as Plugin
    const yUndoPlugin = createYUndoPlugin(undoManager)
    const pluginAfterYUndo = {
      getState: () => null,
      spec: {
        view: () => ({}),
      },
    } as unknown as Plugin
    const yUndoPluginViewDestroy = vi.fn()
    const otherPluginViewDestroy = vi.fn()
    const view = createEditorView(
      [pluginBeforeYUndo, yUndoPlugin, pluginAfterYUndo],
      [{ destroy: yUndoPluginViewDestroy }, { destroy: otherPluginViewDestroy }],
    )

    patchYUndoPluginDestroy(view as unknown as EditorView)
    view.pluginViews[0]?.destroy?.()

    expect(yUndoPluginViewDestroy).toHaveBeenCalledTimes(1)
    expect(undoManager.__yundo_saved).toEqual({
      hasTrackedSelf: true,
      observers: undoManager._observers,
    })

    view.pluginViews[1]?.destroy?.()
    expect(otherPluginViewDestroy).toHaveBeenCalledTimes(1)
  })

  it('applies one future plugin view factory wrapper when patched repeatedly', () => {
    const undoManager = createUndoManager()
    const originalDestroy = vi.fn()
    const originalViewFactory = vi.fn(() => ({ destroy: originalDestroy }))
    const plugin = createYUndoPlugin(undoManager, originalViewFactory)
    const view = createEditorView(plugin, null)

    patchYUndoPluginDestroy(view as unknown as EditorView)
    patchYUndoPluginDestroy(view as unknown as EditorView)

    const nextView = plugin.spec.view?.(view as unknown as EditorView)
    nextView?.destroy?.()

    expect(originalViewFactory).toHaveBeenCalledTimes(1)
    expect(originalDestroy).toHaveBeenCalledTimes(1)
  })
})

describe('runYjsHistoryCommand', () => {
  it('bookmarks collapsed caret selections before running history commands', () => {
    getRelativeSelectionMock.mockReturnValue({
      anchor: {},
      head: {},
      type: 'text',
    })
    const undoManager = createUndoManager()
    const undo = vi.fn()
    const undoPlugin = createYUndoPlugin({ ...undoManager, undo })
    const binding = {
      doc: {},
      mapping: {},
      type: {},
    }
    const bindingPlugin = {
      getState: () => ({ binding }),
      spec: {},
    } as unknown as Plugin
    const view = createEditorView([undoPlugin, bindingPlugin], null, {
      selection: {
        empty: true,
        eq: () => true,
      },
    })

    runYjsHistoryCommand(view as unknown as EditorView, 'undo')

    expect(undo).toHaveBeenCalledOnce()
    expect(getRelativeSelectionMock).toHaveBeenCalledWith(binding, view.state)
  })

  it('runs history when selection bookmark creation fails', () => {
    getRelativeSelectionMock.mockImplementation(() => {
      throw new Error('bookmark failed')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const undo = vi.fn()
    const undoPlugin = createYUndoPlugin({ ...createUndoManager(), undo })
    const bindingPlugin = {
      getState: () => ({ binding: { doc: {}, mapping: {}, type: {} } }),
      spec: {},
    } as unknown as Plugin

    runYjsHistoryCommand(
      createEditorView([undoPlugin, bindingPlugin]) as unknown as EditorView,
      'undo',
    )

    expect(undo).toHaveBeenCalledOnce()
  })
})

describe('patchYSyncAfterTypeChanged', () => {
  it('preserves the undo selection while forcing Yjs sync', () => {
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

  it('re-registers the patched deep observer callback', () => {
    const registeredTypeChanged = vi.fn()
    const deepObservers = new Set<(...args: Array<any>) => void>([registeredTypeChanged])
    const binding = {
      beforeTransactionSelection: null,
      mux: (run: () => void) => run(),
      prosemirrorView: { state: { doc: {} } },
      type: {
        observeDeep: (observer: (...args: Array<any>) => void) => deepObservers.add(observer),
        unobserveDeep: (observer: (...args: Array<any>) => void) => deepObservers.delete(observer),
      },
      _typeChanged: registeredTypeChanged,
      _prosemirrorChanged: vi.fn(),
    }
    const plugin = { getState: () => ({ binding }) } as unknown as Plugin

    patchYSyncAfterTypeChanged(createEditorView(plugin) as unknown as EditorView)
    for (const observer of deepObservers) {
      observer([], {})
    }

    expect(deepObservers).not.toContain(registeredTypeChanged)
    expect(binding._prosemirrorChanged).toHaveBeenCalledOnce()
  })
})

function createUndoManager() {
  const afterTransactionHandler = vi.fn()
  const afterTransactionObservers = new Set<unknown>([afterTransactionHandler])
  const undoManager = {
    _observers: new Map([['stack-item-added', new Set([vi.fn()])]]),
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

type UndoManagerFixture = ReturnType<typeof createUndoManager> & {
  redo?: ReturnType<typeof vi.fn>
  undo?: ReturnType<typeof vi.fn>
}

function createYUndoPlugin(
  undoManager: UndoManagerFixture,
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

function createEditorView(
  plugin: Plugin | Array<Plugin>,
  pluginView: { destroy?: () => void } | Array<{ destroy?: () => void }> | null = {},
  stateOverrides: Record<string, unknown> = {},
) {
  const plugins = Array.isArray(plugin) ? plugin : [plugin]
  const transaction = {
    setMeta: vi.fn(() => transaction),
    setSelection: vi.fn(() => transaction),
  }
  return {
    pluginViews: pluginView === null ? [] : Array.isArray(pluginView) ? pluginView : [pluginView],
    state: {
      doc: {},
      plugins,
      tr: transaction,
      ...stateOverrides,
    },
    dispatch: vi.fn(),
  }
}
