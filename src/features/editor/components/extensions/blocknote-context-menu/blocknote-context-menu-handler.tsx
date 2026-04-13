import { useEffect } from 'react'
import { useBlockNoteEditor } from '@blocknote/react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { openBlockNoteContextMenu } from '~/features/editor/hooks/useBlockNoteContextMenu'
import { useEditorDomElement } from '~/features/editor/hooks/useEditorDomElement'

/**
 * Component that handles right-click context menu events for the entire BlockNote editor.
 * Place this inside BlockNoteView to capture all context menu events.
 */
export function BlockNoteContextMenuHandler() {
  const editor = useBlockNoteEditor() as CustomBlockNoteEditor
  const domElement = useEditorDomElement(editor)

  useEffect(() => {
    if (!domElement) return

    const handleContextMenu = (e: MouseEvent) => {
      // Don't handle if not a trusted event (synthetic)
      if (!e.isTrusted) return

      e.preventDefault()
      e.stopPropagation()

      // Determine what block was clicked
      const target = e.target as HTMLElement
      const blockElement = target.closest('[data-node-type="blockContainer"]')
      const blockNoteId = blockElement?.getAttribute('data-id') ?? undefined

      openBlockNoteContextMenu({
        position: { x: e.clientX, y: e.clientY },
        viewContext: 'note-view',
        item: undefined, // No sidebar item for general editor context
        blockNoteId,
      })
    }

    // Use capture phase to catch events before they bubble
    domElement.addEventListener('contextmenu', handleContextMenu, true)

    return () => {
      domElement.removeEventListener('contextmenu', handleContextMenu, true)
    }
  }, [domElement])

  return null
}
