import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteViewRaw as BlockNoteView } from '@blocknote/react'
import { partialBlockNoteBlockSchema } from 'shared/editor-blocks/blockSchemas'
import { createStaticEditorSchema } from '../static-editor-schema'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import { NoteEmbedSurfaceProvider } from './extensions/embed-block/note-embed-surface-context'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import { logger } from '~/shared/utils/logger'
import { useResolvedTheme } from '~/shared/theme/context'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteValueRuntimeContextValue } from '../value-block/value-block-runtime-context'
import type { PartialBlock } from '@blocknote/core'
import type { CSSProperties, ReactNode } from 'react'
import type { NoteValueAuthoringDefinition, NoteValueRuntimeState } from 'shared/note-values/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

type RawNoteContentProps = {
  children?: ReactNode
  className?: string
  content: Array<CustomBlock>
  editable: boolean
  fillHeight?: boolean
  noteId?: Id<'sidebarItems'>
  onEditorChange?: (editor: CustomBlockNoteEditor | null) => void
  schemaFactory?: (sourceNoteId: Id<'sidebarItems'> | null) => StaticEditorSchema
  style?: CSSProperties
}

const EMPTY_ITEMS: Array<AnySidebarItem> = []
const EMPTY_ITEM_MAP = new Map<Id<'sidebarItems'>, AnySidebarItem>()
const EMPTY_VALUE_DEFINITIONS: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>> = []
const EMPTY_VALUE_STATES: Array<NoteValueRuntimeState<Id<'sidebarItems'>>> = []
type RawEditorSchema = ReturnType<typeof createStaticEditorSchema>
type StaticEditorSchema = RawEditorSchema
type RawNoteInitialContent = Array<
  PartialBlock<
    RawEditorSchema['blockSchema'],
    RawEditorSchema['inlineContentSchema'],
    RawEditorSchema['styleSchema']
  >
>

function createRawValueRuntime({
  editable,
  noteId,
}: {
  editable: boolean
  noteId?: Id<'sidebarItems'>
}): NoteValueRuntimeContextValue {
  return {
    noteId,
    editable,
    authoredDefinitions: EMPTY_VALUE_DEFINITIONS,
    authoredValueStates: EMPTY_VALUE_STATES,
    stateByValueId: new Map(),
    sidebarItems: EMPTY_ITEMS,
    itemsMap: EMPTY_ITEM_MAP,
  }
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
  fillHeight = false,
  noteId,
  onEditorChange,
  schemaFactory,
  style,
}: RawNoteContentProps) {
  const resolvedTheme = useResolvedTheme()
  const editor = useOwnedBlockNoteEditor({
    identity: `${noteId ?? 'raw-note-content'}:${editable}`,
    createEditor: () =>
      BlockNoteEditor.create({
        schema: (schemaFactory ?? createStaticEditorSchema)(noteId ?? null),
        initialContent: validateInitialContent({ content, noteId }),
      }) as unknown as CustomBlockNoteEditor,
    destroyEditor: destroyBlockNoteEditor,
    onEditorChange,
  })

  if (!editor) return null

  return (
    <div className={editable || fillHeight ? 'note-editor-fill-height' : undefined}>
      <div className={className}>
        <NoteValueRuntimeContext.Provider value={createRawValueRuntime({ editable, noteId })}>
          <NoteEmbedSurfaceProvider sourceNoteId={noteId ?? null} editable={editable}>
            <BlockNoteView
              editor={editor}
              style={style}
              theme={resolvedTheme}
              editable={editable}
              sideMenu={false}
              formattingToolbar={false}
              slashMenu={false}
              linkToolbar={false}
              emojiPicker={false}
              filePanel={false}
              tableHandles={false}
              comments={false}
            >
              {children}
            </BlockNoteView>
          </NoteEmbedSurfaceProvider>
        </NoteValueRuntimeContext.Provider>
      </div>
    </div>
  )
}
