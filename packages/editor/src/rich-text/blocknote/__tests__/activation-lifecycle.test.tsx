import { renderHook } from '@testing-library/react'
import type { EditorView } from '@tiptap/pm/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlockNoteActivationLifecycle } from '../activation-lifecycle'
import type { PendingRichEmbedActivationRef } from '../../deferred-activation'

const {
  consoleWarnSpy,
  mockSelectionAtEnd,
  mockTextSelectionNear,
  mockUseDeferredRichEmbedActivation,
} = vi.hoisted(() => ({
  consoleWarnSpy: vi.fn(),
  mockSelectionAtEnd: vi.fn(),
  mockTextSelectionNear: vi.fn(),
  mockUseDeferredRichEmbedActivation: vi.fn(),
}))

vi.mock('@tiptap/pm/state', async () => {
  const actual = await vi.importActual('@tiptap/pm/state')

  return {
    ...actual,
    Selection: {
      atEnd: (...args: Array<unknown>) => mockSelectionAtEnd(...args),
    },
    TextSelection: {
      near: (...args: Array<unknown>) => mockTextSelectionNear(...args),
    },
  }
})

vi.mock('../../deferred-activation', async () => {
  const actual = await vi.importActual('../../deferred-activation')

  return {
    ...actual,
    useDeferredRichEmbedActivation: (options: unknown) => {
      mockUseDeferredRichEmbedActivation(options)
    },
  }
})

describe('useBlockNoteActivationLifecycle', () => {
  beforeEach(() => {
    consoleWarnSpy.mockReset()
    vi.spyOn(console, 'warn').mockImplementation((...args: Array<unknown>) =>
      consoleWarnSpy(...args),
    )
    mockSelectionAtEnd.mockReset()
    mockTextSelectionNear.mockReset()
    mockUseDeferredRichEmbedActivation.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports readiness only when the mounted view exists and extra readiness passes', () => {
    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(createMountedView()),
        isReady: () => true,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [mountedOptions] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    expect(mountedOptions.isReady()).toBe(true)

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(createMountedView({ connected: false })),
        isReady: () => true,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [unmountedOptions] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    expect(unmountedOptions.isReady()).toBe(false)

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(createMountedView({ docView: null })),
        isReady: () => true,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [withoutDocViewOptions] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    expect(withoutDocViewOptions.isReady()).toBe(true)

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(createMountedView()),
        isReady: () => false,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [blockedOptions] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    expect(blockedOptions.isReady()).toBe(false)
  })

  it('keeps readiness pending when the extra readiness predicate throws', () => {
    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(createMountedView()),
        isReady: () => {
          throw new Error('editor is still mounting')
        },
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    expect(options.isReady()).toBe(false)
  })

  it('focuses the mounted editor and restores selection from the activation point', () => {
    mockTextSelectionNear.mockReturnValue('selection')

    const view = createMountedView()

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(view),
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    options.onActivate({ kind: 'point', payload: { point: { x: 10, y: 20 } } })

    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(view.state.doc.resolve).toHaveBeenCalledWith(14)
    expect(mockTextSelectionNear).toHaveBeenCalledWith('resolved-14')
    expect(view.state.tr.setSelection).toHaveBeenCalledWith('selection')
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledTimes(1)
  })

  it('falls back to the document end when activation point placement fails', () => {
    mockSelectionAtEnd.mockReturnValue('selection')

    const view = createMountedView({ posAtCoords: vi.fn(() => null) })

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(view),
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    options.onActivate({ kind: 'point', payload: { point: { x: 10, y: 20 } } })

    expect(mockSelectionAtEnd).toHaveBeenCalledWith(view.state.doc)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith('selection')
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledTimes(1)
  })

  it('uses checked document-end focus when activation has no point payload', () => {
    mockSelectionAtEnd.mockReturnValue('selection')

    const view = createMountedView()
    const onActivated = vi.fn()

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(view),
        onActivated,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []
    options.onActivate({ kind: 'end' })

    expect(mockSelectionAtEnd).toHaveBeenCalledWith(view.state.doc)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith('selection')
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledTimes(1)
    expect(onActivated).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('no-ops safely when the editor view is not mounted', () => {
    const view = createMountedView({ connected: false })
    const onActivated = vi.fn()

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(view),
        onActivated,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []

    expect(() => {
      options.onActivate({ kind: 'point', payload: { point: { x: 10, y: 20 } } })
    }).not.toThrow()
    expect(view.focus).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('treats torn-down editor view access as unavailable', () => {
    const view = createMountedView({ throwsOnDomAccess: true })

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        pendingActivationRef: createPendingActivationRef(),
        editable: true,
        editor: createEditor(view),
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseDeferredRichEmbedActivation.mock.calls.at(-1) ?? []

    expect(options.isReady()).toBe(false)
    expect(() => {
      options.onActivate({ kind: 'end' })
    }).not.toThrow()
    expect(view.focus).not.toHaveBeenCalled()
  })
})

function createPendingActivationRef(): PendingRichEmbedActivationRef {
  return { current: null }
}

function createEditor(view: ReturnType<typeof createMountedView>) {
  return {
    _tiptapEditor: {
      view: view as unknown as EditorView,
    },
  }
}

function createMountedView({
  connected = true,
  docView = {},
  posAtCoords = vi.fn(() => ({ inside: 0, pos: 14 })),
  throwsOnDomAccess = false,
}: {
  connected?: boolean
  docView?: object | null
  posAtCoords?: ReturnType<typeof vi.fn>
  throwsOnDomAccess?: boolean
} = {}) {
  const view = {
    dispatch: vi.fn(),
    focus: vi.fn(),
    posAtCoords,
    state: {
      doc: {
        type: 'doc',
        content: { size: 42 },
        resolve: vi.fn((pos: number) => `resolved-${pos}`),
      },
      tr: {
        setSelection: vi.fn(() => 'transaction'),
      },
    },
  }

  if (throwsOnDomAccess) {
    Object.defineProperty(view, 'dom', {
      enumerable: true,
      get() {
        throw new Error('[tiptap error]: The editor view is not available.')
      },
    })
  } else {
    Object.defineProperty(view, 'dom', {
      enumerable: true,
      value: {
        getBoundingClientRect: vi.fn(() => ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
        })),
        isConnected: connected,
      },
    })
  }

  Object.defineProperty(view, 'docView', {
    enumerable: true,
    value: docView,
  })

  return view
}
