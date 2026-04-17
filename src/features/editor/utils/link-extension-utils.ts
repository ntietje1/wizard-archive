import { createSelectionStabilizerPlugin } from './selection-stabilizer'
import type { RefObject } from 'react'
import type { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/**
 * Check if a range overlaps with the selection
 */
export function overlapsSelection(
  matchFrom: number,
  matchTo: number,
  selFrom: number,
  selTo: number,
): boolean {
  return selFrom <= matchTo && selTo >= matchFrom
}

/** Minimal interface for the tiptap editor methods we use */
interface TiptapEditorLike {
  view: EditorView | undefined
  registerPlugin: (
    plugin: Plugin,
    handlePlugins?: (newPlugin: Plugin, plugins: Array<Plugin>) => Array<Plugin>,
  ) => void
  unregisterPlugin: (keyOrName: PluginKey | string) => void
}

interface RegisterPluginsOptions {
  tiptapEditor: TiptapEditorLike
  pluginKey: PluginKey
  stabilizerKey: PluginKey
  createDecorationPlugin: () => Plugin
  pluginRef: RefObject<Plugin | null>
}

function replacePlugin(
  plugins: Array<Plugin>,
  pluginToAdd: Plugin,
  keyOrName: PluginKey | string,
): Array<Plugin> {
  const name = (() => {
    if (typeof keyOrName === 'string') {
      return `${keyOrName}$`
    }

    const pluginKey = (keyOrName as unknown as { key?: string }).key
    if (!pluginKey) {
      throw new Error('replacePlugin expected a PluginKey with a defined key value')
    }

    return pluginKey
  })()

  return [
    ...plugins.filter((plugin) => {
      const pluginKey = (plugin as unknown as { key?: string }).key
      return typeof pluginKey !== 'string' || !pluginKey.startsWith(name)
    }),
    pluginToAdd,
  ]
}

/**
 * Registers decoration and stabilizer plugins for link extensions.
 * Returns a cleanup function.
 */
export function registerLinkPlugins({
  tiptapEditor,
  pluginKey,
  stabilizerKey,
  createDecorationPlugin,
  pluginRef,
}: RegisterPluginsOptions): () => void {
  let cancelled = false
  let frameId: number | null = null

  const registerPluginWhenReady = () => {
    if (!tiptapEditor.view) {
      frameId = requestAnimationFrame(registerPluginWhenReady)
      return
    }

    if (cancelled) return

    const stabilizerPlugin = createSelectionStabilizerPlugin(stabilizerKey)
    const decorationPlugin = createDecorationPlugin()

    tiptapEditor.registerPlugin(stabilizerPlugin, (newPlugin, plugins) =>
      replacePlugin(plugins, newPlugin, stabilizerKey),
    )
    tiptapEditor.registerPlugin(decorationPlugin, (newPlugin, plugins) =>
      replacePlugin(plugins, newPlugin, pluginKey),
    )
    pluginRef.current = decorationPlugin

    try {
      const { tr } = tiptapEditor.view.state
      tiptapEditor.view.dispatch(tr.setMeta(pluginKey, true))
    } catch {
      // View might not be ready
    }
  }

  registerPluginWhenReady()

  return () => {
    cancelled = true
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
    }
    try {
      tiptapEditor.unregisterPlugin(stabilizerKey)
    } catch {
      // Plugin might already be unregistered
    }
    try {
      tiptapEditor.unregisterPlugin(pluginKey)
    } catch {
      // Plugin might already be unregistered
    }
    pluginRef.current = null
  }
}
