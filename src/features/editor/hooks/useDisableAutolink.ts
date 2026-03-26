import { useEffect } from 'react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'

/**
 * Hook that disables autolink behavior in the editor.
 * This prevents URLs from being automatically converted to links.
 */
export function useDisableAutolink(editor: CustomBlockNoteEditor | undefined) {
  useEffect(() => {
    const tiptapEditor = editor?._tiptapEditor
    if (!tiptapEditor) return

    // Find the Link extension and disable autolink
    const linkExtension = tiptapEditor.extensionManager.extensions.find(
      (ext) => ext.name === 'link',
    )

    if (linkExtension) {
      // Disable autolink and linkOnPaste
      linkExtension.options.autolink = false
      linkExtension.options.linkOnPaste = false
      linkExtension.options.openOnClick = false
    }
  }, [editor])
}
