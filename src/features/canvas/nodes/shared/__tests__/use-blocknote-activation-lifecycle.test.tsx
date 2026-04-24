import { renderHook } from '@testing-library/react'
import type { EditorView } from '@tiptap/pm/view'
import { describe, expect, it, vi } from 'vitest'
import {
  getMountedBlockNoteView,
  useBlockNoteActivationLifecycle,
} from '../use-blocknote-activation-lifecycle'
import type { BlockNoteEditorWithMountedView } from '../use-blocknote-activation-lifecycle'
import type { RichEmbedLifecycleController } from '../../embed/use-rich-embed-lifecycle'

const { mockLoggerWarn, mockTextSelectionCreate, mockUseRichEmbedLifecycle } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockTextSelectionCreate: vi.fn(),
  mockUseRichEmbedLifecycle: vi.fn(),
}))

vi.mock('@tiptap/pm/state', async () => {
  const actual = await vi.importActual('@tiptap/pm/state')

  return {
    ...actual,
    TextSelection: {
      create: (...args: Array<unknown>) => mockTextSelectionCreate(...args),
    },
  }
})

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    warn: (...args: Array<unknown>) => mockLoggerWarn(...args),
  },
}))

vi.mock('../../embed/use-rich-embed-lifecycle', async () => {
  const actual = await vi.importActual('../../embed/use-rich-embed-lifecycle')

  return {
    ...actual,
    useRichEmbedLifecycle: (options: unknown) => {
      mockUseRichEmbedLifecycle(options)
    },
  }
})

describe('useBlockNoteActivationLifecycle', () => {
  it('reports readiness only when the mounted view exists and extra readiness passes', () => {
    renderHook(() =>
      useBlockNoteActivationLifecycle({
        lifecycle: createLifecycle(),
        editable: true,
        editor: createEditor(createMountedView()),
        isReady: () => true,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [mountedOptions] = mockUseRichEmbedLifecycle.mock.calls.at(-1) ?? []
    expect(mountedOptions.isReady()).toBe(true)

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        lifecycle: createLifecycle(),
        editable: true,
        editor: createEditor(createMountedView({ connected: false })),
        isReady: () => true,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [unmountedOptions] = mockUseRichEmbedLifecycle.mock.calls.at(-1) ?? []
    expect(unmountedOptions.isReady()).toBe(false)

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        lifecycle: createLifecycle(),
        editable: true,
        editor: createEditor(createMountedView()),
        isReady: () => false,
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [blockedOptions] = mockUseRichEmbedLifecycle.mock.calls.at(-1) ?? []
    expect(blockedOptions.isReady()).toBe(false)
  })

  it('focuses the mounted editor and restores selection from the activation point', () => {
    mockTextSelectionCreate.mockReturnValue('selection')

    const view = createMountedView()

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        lifecycle: createLifecycle(),
        editable: true,
        editor: createEditor(view),
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseRichEmbedLifecycle.mock.calls.at(-1) ?? []
    options.onActivate({ point: { x: 10, y: 20 } })

    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(mockTextSelectionCreate).toHaveBeenCalledWith(view.state.doc, 14)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith('selection')
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledTimes(1)
  })

  it('no-ops safely when the editor view is not mounted', () => {
    const view = createMountedView({ connected: false })

    renderHook(() =>
      useBlockNoteActivationLifecycle({
        lifecycle: createLifecycle(),
        editable: true,
        editor: createEditor(view),
        onActivationErrorMessage: 'failed to activate',
      }),
    )

    const [options] = mockUseRichEmbedLifecycle.mock.calls.at(-1) ?? []

    expect(() => {
      options.onActivate({ point: { x: 10, y: 20 } })
    }).not.toThrow()
    expect(view.focus).not.toHaveBeenCalled()
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })
})

describe('getMountedBlockNoteView', () => {
  it('returns null when the ProseMirror view is not connected', () => {
    expect(
      getMountedBlockNoteView(createEditor(createMountedView({ connected: false }))),
    ).toBeNull()
    expect(getMountedBlockNoteView(createEditor(createMountedView({ docView: null })))).toBeNull()
  })

  it('returns null when reading docView throws before the editor mounts', () => {
    expect(
      getMountedBlockNoteView(createEditor(createMountedView({ throwsOnDocViewAccess: true }))),
    ).toBeNull()
  })
})

function createLifecycle(): RichEmbedLifecycleController {
  return {
    pendingActivationRef: {
      current: null,
    },
  }
}

function createEditor(view: ReturnType<typeof createMountedView>): BlockNoteEditorWithMountedView {
  return {
    _tiptapEditor: {
      view: view as unknown as EditorView,
    },
  }
}

function createMountedView({
  connected = true,
  docView = {},
  throwsOnDocViewAccess = false,
}: {
  connected?: boolean
  docView?: object | null
  throwsOnDocViewAccess?: boolean
} = {}) {
  const view = {
    dispatch: vi.fn(),
    focus: vi.fn(),
    posAtCoords: vi.fn(() => ({ inside: 0, pos: 14 })),
    state: {
      doc: { type: 'doc' },
      tr: {
        setSelection: vi.fn(() => 'transaction'),
      },
    },
    dom: {
      isConnected: connected,
    },
  }

  if (throwsOnDocViewAccess) {
    Object.defineProperty(view, 'docView', {
      get() {
        throw new Error('[tiptap error]: The editor view is not available.')
      },
    })
    return view
  }

  return {
    ...view,
    docView,
  }
}
