import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginKey } from '@tiptap/pm/state'
import type { Plugin } from '@tiptap/pm/state'
import { registerLinkPlugins } from '../link-extension-utils'

const { mockCreateSelectionStabilizerPlugin } = vi.hoisted(() => ({
  mockCreateSelectionStabilizerPlugin: vi.fn(),
}))

vi.mock('../selection-stabilizer', () => ({
  createSelectionStabilizerPlugin: (...args: Array<unknown>) =>
    mockCreateSelectionStabilizerPlugin(...args),
}))

describe('registerLinkPlugins', () => {
  const pluginKey = new PluginKey('linkDecoration')
  const stabilizerKey = new PluginKey('selectionStabilizer')
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>
  let cancelAnimationFrameSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    requestAnimationFrameSpy = vi.fn()
    cancelAnimationFrameSpy = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameSpy)
    mockCreateSelectionStabilizerPlugin.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers on the next frame when the editor view is ready', () => {
    const registerPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    const dispatch = vi.fn()
    let queuedFrame: ((time: number) => void) | undefined

    requestAnimationFrameSpy.mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = (time: number) => cb(time)
      return 7
    })
    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const cleanup = registerLinkPlugins({
      tiptapEditor: {
        view: {
          state: { tr: { setMeta } },
          dispatch,
        } as never,
        registerPlugin,
      },
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
    })

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    expect(registerPlugin).not.toHaveBeenCalled()
    queuedFrame?.(0)

    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
    expect(mockCreateSelectionStabilizerPlugin).toHaveBeenCalledWith(stabilizerKey)
    expect(setMeta).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()

    cleanup()
  })

  it('retries until the editor view is available', () => {
    const registerPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    const queuedFrames: Array<(time: number) => void> = []

    requestAnimationFrameSpy.mockImplementation((cb: FrameRequestCallback) => {
      queuedFrames.push((time: number) => cb(time))
      return queuedFrames.length
    })
    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const tiptapEditor = {
      view: undefined,
      registerPlugin,
    }

    registerLinkPlugins({
      tiptapEditor,
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
    })

    expect(registerPlugin).not.toHaveBeenCalled()
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    queuedFrames[0](0)

    expect(registerPlugin).not.toHaveBeenCalled()
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)

    const dispatch = vi.fn()
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    tiptapEditor.view = {
      state: { tr: { setMeta } },
      dispatch,
    } as never
    queuedFrames[1](0)

    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
    expect(mockCreateSelectionStabilizerPlugin).toHaveBeenCalledWith(stabilizerKey)
    expect(setMeta).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('waits while BlockNote exposes an unmounted editor view', () => {
    const registerPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    let queuedFrame: ((time: number) => void) | undefined

    requestAnimationFrameSpy.mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = (time: number) => cb(time)
      return 8
    })
    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const tiptapEditor = {
      view: {
        get dom() {
          throw new Error('view not mounted')
        },
      },
      registerPlugin,
    }

    registerLinkPlugins({
      tiptapEditor: tiptapEditor as never,
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
    })

    expect(registerPlugin).not.toHaveBeenCalled()
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

    const dispatch = vi.fn()
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    tiptapEditor.view = {
      dom: document.createElement('div'),
      state: { tr: { setMeta } },
      dispatch,
    } as never
    queuedFrame?.(0)

    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
  })

  it('does not replace an already registered plugin for the same editor lifecycle', () => {
    const registerPlugin = vi.fn()
    const firstDecorationPlugin = { name: 'first-decoration' } as unknown as Plugin
    const secondDecorationPlugin = { name: 'second-decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    const dispatch = vi.fn()
    const state = { tr: { setMeta } } as Record<string, unknown>
    const tiptapEditor = {
      view: {
        dom: document.createElement('div'),
        state,
        dispatch,
      },
      registerPlugin,
    } as never

    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const firstCleanup = registerLinkPlugins({
      tiptapEditor,
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => firstDecorationPlugin,
    })
    requestAnimationFrameSpy.mock.calls[0][0](0)
    state[(pluginKey as unknown as { key: string }).key] = {}
    firstCleanup()

    registerLinkPlugins({
      tiptapEditor,
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => secondDecorationPlugin,
    })
    requestAnimationFrameSpy.mock.calls[1][0](0)

    expect(registerPlugin).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('cleans up pending frames without deconfiguring the editor view on teardown', () => {
    const registerPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin

    requestAnimationFrameSpy.mockReturnValue(9)

    const cleanup = registerLinkPlugins({
      tiptapEditor: {
        view: undefined,
        registerPlugin,
      },
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
    })

    cleanup()

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(9)
    expect(registerPlugin).not.toHaveBeenCalled()
  })
})
