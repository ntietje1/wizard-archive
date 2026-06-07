import { BlockNoteEditor } from '@blocknote/core'
import { partialBlockNoteBlockSchema } from 'shared/editor-blocks/blockSchemas'
import { isDangerousUrl } from 'shared/links/parsing'
import { createStaticEditorSchema } from '../static-editor-schema'
import { NoteEditorCore } from './note-editor-core'
import { NoteValueRuntimeContext } from '../value-block/value-block-runtime-context'
import { useOwnedBlockNoteEditor } from '~/features/editor/hooks/useOwnedBlockNoteEditor'
import { destroyBlockNoteEditor } from '~/features/editor/utils/destroy-blocknote-editor'
import { logger } from '~/shared/utils/logger'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'
import type { NoteValueRuntimeContextValue } from '../value-block/value-block-runtime-context'
import type { PartialBlock } from '@blocknote/core'
import type { CSSProperties, ReactNode } from 'react'
import type { ParsedLinkData, ResolvedLink } from 'shared/links/types'
import type { NoteValueAuthoringDefinition, NoteValueRuntimeState } from 'shared/note-values/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
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

const EMPTY_ITEMS: Array<AnySidebarItem> = []
const EMPTY_ITEM_MAP = new Map<Id<'sidebarItems'>, AnySidebarItem>()
const EMPTY_VALUE_DEFINITIONS: Array<NoteValueAuthoringDefinition<Id<'sidebarItems'>>> = []
const EMPTY_VALUE_STATES: Array<NoteValueRuntimeState<Id<'sidebarItems'>>> = []
type RawEditorSchema = ReturnType<typeof createStaticEditorSchema>
type RawNoteInitialContent = Array<
  PartialBlock<
    RawEditorSchema['blockSchema'],
    RawEditorSchema['inlineContentSchema'],
    RawEditorSchema['styleSchema']
  >
>
const RAW_EDITABLE_LINK_RESOLVER = createRawLinkResolver(false)
const RAW_VIEWER_LINK_RESOLVER = createRawLinkResolver(true)

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

function createRawLinkResolver(isViewerMode: boolean): LinkResolver {
  return {
    allItems: EMPTY_ITEMS,
    itemsMap: EMPTY_ITEM_MAP,
    isViewerMode,
    resolveLink: resolveRawLink,
  }
}

function resolveRawLink(parsed: ParsedLinkData): ResolvedLink<Id<'sidebarItems'>> {
  if (parsed.isExternal) {
    return {
      ...parsed,
      resolved: true,
      itemId: null,
      href: isDangerousUrl(parsed.rawTarget) ? null : parsed.rawTarget,
      color: null,
    }
  }

  return {
    ...parsed,
    resolved: false,
    itemId: null,
    href: null,
    color: null,
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
  noteId,
  onEditorChange,
  style,
}: RawNoteContentProps) {
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
          <NoteEditorCore
            editor={editor}
            style={style}
            editable={editable}
            linkResolver={editable ? RAW_EDITABLE_LINK_RESOLVER : RAW_VIEWER_LINK_RESOLVER}
          >
            {children}
          </NoteEditorCore>
        </NoteValueRuntimeContext.Provider>
      </div>
    </div>
  )
}
