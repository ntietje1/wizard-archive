import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/shadcn'
import { partialBlockNoteBlockSchema } from 'shared/editor-blocks/blockSchemas'
import { createStaticEditorSchema } from '../static-editor-schema'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import { useResolvedTheme } from '~/shared/theme/context'
import { logger } from '~/shared/utils/logger'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteValueRuntimeContextValue } from '../value-block/value-block-runtime-context'
import type { PartialBlock } from '@blocknote/core'
import type { CSSProperties, ReactNode } from 'react'
import type { Id } from 'convex/_generated/dataModel'

type RawNoteContentProps = {
  children?: ReactNode
  className?: string
  content: Array<CustomBlock>
  editable: boolean
  noteId?: Id<'sidebarItems'>
  onEditorChange?: (editor: CustomBlockNoteEditor | null) => void
  style?: CSSProperties
}

const EMPTY_ITEMS: [] = []
const EMPTY_ITEM_MAP = new Map()
type StaticEditorSchema = ReturnType<typeof createStaticEditorSchema>
type RawNoteInitialContent = Array<
  PartialBlock<
    StaticEditorSchema['blockSchema'],
    StaticEditorSchema['inlineContentSchema'],
    StaticEditorSchema['styleSchema']
  >
>

function createRawValueRuntime({
  editable,
  noteId,
}: {
  editable: boolean
  noteId?: Id<'sidebarItems'>
}) {
  return {
    noteId,
    editable,
    authoredDefinitions: EMPTY_ITEMS,
    authoredValueStates: EMPTY_ITEMS,
    stateByValueId: new Map(),
    sidebarItems: EMPTY_ITEMS,
    itemsMap: EMPTY_ITEM_MAP,
  } satisfies NoteValueRuntimeContextValue
}

function validateInitialContent({
  content,
  noteId,
}: {
  content: Array<CustomBlock>
  noteId?: Id<'sidebarItems'>
}): RawNoteInitialContent | undefined {
  if (content.length === 0) return undefined

  const validatedContent = content.map((block) => {
    const validation = partialBlockNoteBlockSchema.safeParse(block)
    if (!validation.success) {
      logger.warn('Raw note content failed block validation', {
        noteId,
        error: validation.error.message,
      })
      return null
    }
    return validation.data
  })

  if (validatedContent.some((block) => block === null)) {
    return undefined
  }

  return validatedContent as RawNoteInitialContent
}

export function RawNoteContent({
  children,
  className,
  content,
  editable,
  noteId,
  onEditorChange,
  style,
}: RawNoteContentProps) {
  const resolvedTheme = useResolvedTheme()
  const editor = useOwnedBlockNoteEditor({
    identity: `${noteId ?? 'raw-note-content'}:${editable}`,
    createEditor: () =>
      BlockNoteEditor.create({
        schema: createStaticEditorSchema(),
        initialContent: validateInitialContent({ content, noteId }),
      }) as CustomBlockNoteEditor,
    destroyEditor: destroyBlockNoteEditor,
    onEditorChange,
  })

  if (!editor) return null

  return (
    <div className={editable ? 'note-editor-fill-height' : undefined}>
      <div className={className}>
        <NoteValueRuntimeContext.Provider value={createRawValueRuntime({ editable, noteId })}>
          <BlockNoteView
            editor={editor}
            style={style}
            theme={resolvedTheme}
            editable={editable}
            sideMenu={false}
            formattingToolbar={false}
            slashMenu={false}
            linkToolbar={false}
          >
            {children}
          </BlockNoteView>
        </NoteValueRuntimeContext.Provider>
      </div>
    </div>
  )
}
