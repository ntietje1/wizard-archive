import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { Schema } from '@tiptap/pm/model'
import { registerLinkPlugins } from '../plugin-registration'

const { mockCreateSelectionStabilizerPlugin } = vi.hoisted(() => ({
  mockCreateSelectionStabilizerPlugin: vi.fn(),
}))

vi.mock('../selection-stabilizer', () => ({
  createSelectionStabilizerPlugin: (...args: Array<unknown>) =>
    mockCreateSelectionStabilizerPlugin(...args),
}))

const schema = new Schema({
  nodes: {
    doc: { content: 'text*' },
    text: { group: 'inline' },
  },
})

function createStateWithPluginState(pluginKey: PluginKey, value: unknown) {
  return EditorState.create({
    schema,
    plugins: [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => value,
          apply: (_tr, current) => current,
        },
      }),
    ],
  })
}

function readPluginKey(plugin: Plugin) {
  return (plugin as unknown as { key: string }).key
}

function pluginKeys(plugins: Array<Plugin>) {
  return plugins.map(readPluginKey)
}

describe('registerLinkPlugins', () => {
  const pluginKey = new PluginKey('linkDecoration')
  const stabilizerKey = new PluginKey('selectionStabilizer')
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    requestAnimationFrameSpy = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    mockCreateSelectionStabilizerPlugin.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers on the next frame when the editor view is ready', () => {
    const registerPlugin = vi.fn()
    const decorationPlugin = { name: 'decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    let queuedFrame: ((time: number) => void) | undefined

    requestAnimationFrameSpy.mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = (time: number) => cb(time)
      return 7
    })
    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    const cleanup = registerLinkPlugins({
      tiptapEditor: {
        view: {
          state: { tr: { setMeta: vi.fn() } },
          dispatch: vi.fn(),
        } as never,
        registerPlugin,
      },
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
    })

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    queuedFrame?.(0)

    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
    expect(mockCreateSelectionStabilizerPlugin).toHaveBeenCalledWith(stabilizerKey)

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

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    queuedFrames[0](0)

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)

    tiptapEditor.view = {
      state: { tr: { setMeta: vi.fn() } },
      dispatch: vi.fn(),
    } as never
    queuedFrames[1](0)

    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
    expect(mockCreateSelectionStabilizerPlugin).toHaveBeenCalledWith(stabilizerKey)
  })

  it('waits while BlockNote exposes an unmounted editor view', () => {
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

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)
    queuedFrames[0](0)

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)

    tiptapEditor.view = {
      dom: document.createElement('div'),
      state: { tr: { setMeta: vi.fn() } },
      dispatch: vi.fn(),
    } as never
    queuedFrames[1](0)

    expect(registerPlugin).toHaveBeenNthCalledWith(1, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(2, decorationPlugin, expect.any(Function))
  })

  it('replaces and refreshes already registered link decorations for the same editor lifecycle', () => {
    const registerPlugin = vi.fn()
    const firstDecorationPlugin = { name: 'first-decoration' } as unknown as Plugin
    const secondDecorationPlugin = { name: 'second-decoration' } as unknown as Plugin
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    const setMeta = vi.fn().mockReturnValue('meta-tr')
    const dispatch = vi.fn()
    let state: unknown = { tr: { setMeta } }
    const tiptapEditor = {
      view: {
        dom: document.createElement('div'),
        get state() {
          return state
        },
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
    state = createStateWithPluginState(pluginKey, {})
    firstCleanup()

    registerLinkPlugins({
      tiptapEditor,
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => secondDecorationPlugin,
    })
    requestAnimationFrameSpy.mock.calls[1][0](0)

    expect(registerPlugin).toHaveBeenCalledTimes(4)
    expect(registerPlugin).toHaveBeenNthCalledWith(3, stabilizerPlugin, expect.any(Function))
    expect(registerPlugin).toHaveBeenNthCalledWith(4, secondDecorationPlugin, expect.any(Function))
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('replaces existing plugins from the same key family', () => {
    const registerPlugin = vi.fn()
    const existingDecorationPlugin = new Plugin({ key: new PluginKey('linkDecoration') })
    const decorationPlugin = new Plugin({ key: new PluginKey('linkDecoration') })
    const unrelatedPlugin = new Plugin({ key: new PluginKey('unrelated') })
    const stabilizerPlugin = { name: 'stabilizer' } as unknown as Plugin
    let queuedFrame: ((time: number) => void) | undefined

    requestAnimationFrameSpy.mockImplementation((cb: FrameRequestCallback) => {
      queuedFrame = (time: number) => cb(time)
      return 8
    })
    mockCreateSelectionStabilizerPlugin.mockReturnValue(stabilizerPlugin)

    registerLinkPlugins({
      tiptapEditor: {
        view: {
          dom: document.createElement('div'),
          state: { tr: { setMeta: vi.fn() } },
          dispatch: vi.fn(),
        } as never,
        registerPlugin,
      },
      pluginKey,
      stabilizerKey,
      createDecorationPlugin: () => decorationPlugin,
    })
    queuedFrame?.(0)

    const replaceDecorationPlugin = registerPlugin.mock.calls[1][1]
    const replacedPlugins = replaceDecorationPlugin(decorationPlugin, [
      unrelatedPlugin,
      existingDecorationPlugin,
    ])

    expect(pluginKeys(replacedPlugins)).toEqual([
      readPluginKey(unrelatedPlugin),
      readPluginKey(decorationPlugin),
    ])
  })
})
