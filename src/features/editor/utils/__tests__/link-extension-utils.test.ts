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

  it('registers synchronously when the editor view is already ready', () => {
    const registerPlugin = vi.fn()
    const unregisterPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    const pluginRef = { current: null }
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    const dispatch = vi.fn()

    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const cleanup = registerLinkPlugins({
      tiptapEditor: {
        view: {
          state: { tr: { setMeta } },
          dispatch,
        } as never,
        registerPlugin,
        unregisterPlugin,
      },
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
      pluginRef,
    })

    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
    expect(unregisterPlugin).not.toHaveBeenCalled()
    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
    expect(pluginRef.current).toBe(decorationPlugin)
    expect(mockCreateSelectionStabilizerPlugin).toHaveBeenCalledWith(stabilizerKey)
    expect(setMeta).toHaveBeenCalledWith(pluginKey, true)
    expect(dispatch).toHaveBeenCalledWith('meta-tr')

    cleanup()

    expect(unregisterPlugin).toHaveBeenNthCalledWith(1, stabilizerKey)
    expect(unregisterPlugin).toHaveBeenNthCalledWith(2, pluginKey)
  })

  it('waits for the editor view before registering plugins', () => {
    const registerPlugin = vi.fn()
    const unregisterPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    const pluginRef = { current: null }
    let queuedFrame: ((time: number) => void) | undefined

    requestAnimationFrameSpy.mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = (time: number) => cb(time)
      return 7
    })
    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const tiptapEditor = {
      view: undefined,
      registerPlugin,
      unregisterPlugin,
    }

    registerLinkPlugins({
      tiptapEditor,
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
      pluginRef,
    })

    expect(registerPlugin).not.toHaveBeenCalled()
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

    const dispatch = vi.fn()
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    tiptapEditor.view = {
      state: { tr: { setMeta } },
      dispatch,
    } as never
    queuedFrame?.(0)

    expect(unregisterPlugin).not.toHaveBeenCalled()
    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
    expect(pluginRef.current).toBe(decorationPlugin)
    expect(mockCreateSelectionStabilizerPlugin).toHaveBeenCalledWith(stabilizerKey)
    expect(setMeta).toHaveBeenCalledWith(pluginKey, true)
    expect(dispatch).toHaveBeenCalledWith('meta-tr')
  })

  it('cleans up pending frames and unregisters plugins on teardown', () => {
    const registerPlugin = vi.fn()
    const unregisterPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const pluginRef = { current: null as Plugin | null }

    requestAnimationFrameSpy.mockReturnValue(9)

    const cleanup = registerLinkPlugins({
      tiptapEditor: {
        view: undefined,
        registerPlugin,
        unregisterPlugin,
      },
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
      pluginRef,
    })

    cleanup()

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(9)
    expect(unregisterPlugin).toHaveBeenNthCalledWith(1, stabilizerKey)
    expect(unregisterPlugin).toHaveBeenNthCalledWith(2, pluginKey)
    expect(pluginRef.current).toBeNull()
    expect(registerPlugin).not.toHaveBeenCalled()
  })
})
