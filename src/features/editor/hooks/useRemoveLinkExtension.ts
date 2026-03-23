import { useEffect } from 'react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

/**
 * Hook that removes the Link extension from TipTap.
 * This disables all link functionality including autolink.
 */
export function useRemoveLinkExtension(
  editor: CustomBlockNoteEditor | undefined,
) {
  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    let cancelled = false
    let frameId: number | null = null

    const removeExtensionWhenReady = () => {
      if (!tiptapEditor.view) {
        frameId = requestAnimationFrame(removeExtensionWhenReady)
        return
      }

      if (cancelled) return

      // Find and unregister the Link extension
      const linkExtension = tiptapEditor.extensionManager.extensions.find(
        (ext) => ext.name === 'link',
      )

      if (linkExtension) {
        // Get all plugins from the Link extension
        const linkPluginKeys = linkExtension.storage?.linkPluginKey
          ? [linkExtension.storage.linkPluginKey]
          : []

        // Try to find link-related plugins by name pattern
        const state = tiptapEditor.view.state
        const linkPlugins = state.plugins.filter((plugin) => {
          const key = plugin.spec.key
          return (
            key &&
            (key.toString().includes('link') ||
              key.toString().includes('autolink'))
          )
        })

        // Unregister each link plugin
        for (const plugin of linkPlugins) {
          if (plugin.spec.key) {
            try {
              tiptapEditor.unregisterPlugin(plugin.spec.key)
            } catch {
              // Plugin might not be registered or already removed
            }
          }
        }
      }
    }

    removeExtensionWhenReady()

    return () => {
      cancelled = true
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [editor])
}
