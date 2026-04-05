import { useEffect, useState } from 'react'
import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/shadcn'
import { editorSchema } from 'convex/notes/editorSpecs'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'

export function EmbedNoteContent({ content }: { content: Array<CustomBlock> }) {
  const resolvedTheme = useResolvedTheme()
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)

  console.log('[EmbedNoteContent] content:', content)

  useEffect(() => {
    const initialContent = content.length > 0 ? content : undefined
    console.log('[EmbedNoteContent] initialContent:', initialContent)
    const instance = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent,
    }) as CustomBlockNoteEditor

    setEditor(instance)

    return () => {
      instance._tiptapEditor.destroy()
    }
  }, [])

  useEffect(() => {
    if (editor && content.length > 0) {
      editor.replaceBlocks(editor.document, content)
    }
  }, [editor, content])

  if (!editor) return null

  return (
    <div className="nodrag nopan nowheel h-full overflow-auto">
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme}
        editable={false}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
      />
    </div>
  )
}
