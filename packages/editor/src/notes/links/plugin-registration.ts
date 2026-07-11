import { createSelectionStabilizerPlugin } from './selection-stabilizer'
import type { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export interface LinkPluginEditor {
  view: EditorView | undefined
  registerPlugin: (
    plugin: Plugin,
    handlePlugins?: (newPlugin: Plugin, plugins: Array<Plugin>) => Array<Plugin>,
  ) => void
}

interface RegisterPluginsOptions {
  tiptapEditor: LinkPluginEditor
  pluginKey: PluginKey
  stabilizerKey: PluginKey
  createDecorationPlugin: () => Plugin
}

function replacePlugin(plugins: Array<Plugin>, pluginToAdd: Plugin, key: PluginKey): Array<Plugin> {
  const familyName = getPluginKeyFamilyName(getPluginKeyName(key))

  return [
    ...plugins.filter((plugin) => {
      const pluginKey = (plugin as unknown as { key?: string }).key
      return typeof pluginKey !== 'string' || getPluginKeyFamilyName(pluginKey) !== familyName
    }),
    pluginToAdd,
  ]
}

function getPluginKeyFamilyName(pluginKey: string): string {
  return pluginKey.replace(/\$\d*$/, '')
}

function getPluginKeyName(pluginKey: PluginKey): string {
  const name = (pluginKey as unknown as { key?: string }).key
  if (!name) {
    throw new Error('replacePlugin expected a PluginKey with a defined key value')
  }

  return name
}

export function registerLinkPlugins({
  tiptapEditor,
  pluginKey,
  stabilizerKey,
  createDecorationPlugin,
}: RegisterPluginsOptions): () => void {
  let cancelled = false
  let frameId: number | null = null

  const registerPluginWhenReady = () => {
    const view = getMountedEditorView(tiptapEditor)
    if (!view) {
      frameId = requestAnimationFrame(registerPluginWhenReady)
      return
    }

    if (cancelled) return
    const existingDecorationPlugin = pluginKey.getState(view.state) !== undefined

    const stabilizerPlugin = createSelectionStabilizerPlugin(stabilizerKey)
    const decorationPlugin = createDecorationPlugin()

    tiptapEditor.registerPlugin(stabilizerPlugin, (newPlugin, plugins) =>
      replacePlugin(plugins, newPlugin, stabilizerKey),
    )
    tiptapEditor.registerPlugin(decorationPlugin, (newPlugin, plugins) =>
      replacePlugin(plugins, newPlugin, pluginKey),
    )

    if (existingDecorationPlugin) {
      forceRebuildLinkDecorations(view, pluginKey)
    }
  }

  frameId = requestAnimationFrame(registerPluginWhenReady)

  return () => {
    cancelled = true
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
    }
  }
}

function forceRebuildLinkDecorations(view: EditorView, pluginKey: PluginKey) {
  try {
    const { tr } = view.state
    view.dispatch(tr.setMeta(pluginKey, true))
  } catch {
    // The view can disappear while BlockNote is mounting or unmounting.
  }
}

function getMountedEditorView(tiptapEditor: LinkPluginEditor) {
  try {
    const view = tiptapEditor.view
    if (!view) return undefined
    void view.dom
    return view
  } catch {
    return undefined
  }
}
