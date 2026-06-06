import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/shadcn'
import { createEditorSchema } from '../editor-specs'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import { useResolvedTheme } from '~/shared/theme/context'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteValueRuntimeContextValue } from '../value-block/value-block-runtime-context'
import type { CSSProperties, ReactNode } from 'react'

const EMPTY_ITEMS: [] = []
const EMPTY_ITEM_MAP = new Map()
const EMPTY_VALUE_RUNTIME = {
  editable: false,
  authoredDefinitions: EMPTY_ITEMS,
  authoredValueStates: EMPTY_ITEMS,
  stateByValueId: new Map(),
  sidebarItems: EMPTY_ITEMS,
  itemsMap: EMPTY_ITEM_MAP,
} satisfies NoteValueRuntimeContextValue

export function StaticNoteContent({
  children,
  className,
  content,
  style,
}: {
  children?: ReactNode
  className?: string
  content: Array<CustomBlock>
  style?: CSSProperties
}) {
  const resolvedTheme = useResolvedTheme()
  const editor = useOwnedBlockNoteEditor({
    identity: `static-note-content:${JSON.stringify(content)}`,
    createEditor: () =>
      BlockNoteEditor.create({
        schema: createEditorSchema(),
        initialContent:
          content.length > 0
            ? (content as NonNullable<
                Parameters<typeof BlockNoteEditor.create>[0]
              >['initialContent'])
            : undefined,
      }) as unknown as CustomBlockNoteEditor,
    destroyEditor: destroyBlockNoteEditor,
  })

  if (!editor) return null

  return (
    <div className={className}>
      <NoteValueRuntimeContext.Provider value={EMPTY_VALUE_RUNTIME}>
        <BlockNoteView
          editor={editor}
          style={style}
          theme={resolvedTheme}
          editable={false}
          sideMenu={false}
          formattingToolbar={false}
          slashMenu={false}
          linkToolbar={false}
        >
          {children}
        </BlockNoteView>
      </NoteValueRuntimeContext.Provider>
    </div>
  )
}
