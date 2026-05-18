import { resolveNoteRenderModel } from './note-render-model'
import { CollaborativeBlockNoteEditor, StaticBlockNoteEditor } from './blocknote-editor-instance'
import { useNoteCollaborationSession } from '~/features/editor/hooks/use-note-collaboration-session'
import type { NoteEditorChangeHandler } from './blocknote-editor-instance'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { NoteRenderModel } from './note-render-model'
import type { NoteWithContent } from 'convex/notes/types'
import type { CSSProperties } from 'react'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'

type NoteContentBaseProps = {
  editable: boolean
  className?: string
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}

type LiveNoteContentProps = NoteContentBaseProps & {
  note: NoteWithContent
  noteId?: never
  content?: never
}

type RawNoteContentProps = NoteContentBaseProps & {
  note?: never
  noteId?: Id<'sidebarItems'>
  content: Array<CustomBlock>
}

type NoteContentProps = LiveNoteContentProps | RawNoteContentProps

export function NoteContent({
  note,
  noteId,
  content,
  editable,
  className,
  style,
  children,
  onEditorChange,
}: NoteContentProps) {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const { itemsMap } = useActiveSidebarItems()
  const model = resolveNoteRenderModel({
    source: note ? { kind: 'live', note } : { kind: 'raw', noteId, content },
    requestedEditable: editable,
    isDm,
    viewAsPlayerId,
    allItemsMap: itemsMap,
  })
  const sourceNoteId = model.source === 'live' ? model.note._id : model.noteId
  const sourceNote = model.source === 'live' ? model.note : undefined

  const editor =
    model.source === 'live' && model.renderMode !== 'static' ? (
      <NoteContentWithSession model={model} style={style} onEditorChange={onEditorChange}>
        {children}
      </NoteContentWithSession>
    ) : (
      <StaticBlockNoteEditor
        note={sourceNote}
        noteId={sourceNoteId}
        content={model.content}
        style={style}
        onEditorChange={onEditorChange}
      >
        {children}
      </StaticBlockNoteEditor>
    )

  return (
    <div className={model.renderMode === 'collaborative' ? 'note-editor-fill-height' : undefined}>
      <div className={className}>{editor}</div>
    </div>
  )
}

function NoteContentWithSession({
  model,
  style,
  children,
  onEditorChange,
}: {
  model: Extract<NoteRenderModel, { source: 'live' }>
  style?: CSSProperties
  children?: React.ReactNode
  onEditorChange?: NoteEditorChangeHandler
}) {
  const canEdit =
    model.renderMode === 'collaborative' || model.renderMode === 'static-with-collaboration'
  const session = useNoteCollaborationSession({
    noteId: model.note._id,
    canEdit,
  })

  if (model.renderMode === 'static-with-collaboration') {
    return (
      <StaticBlockNoteEditor
        note={model.note}
        noteId={model.note._id}
        content={model.content}
        style={style}
        onEditorChange={onEditorChange}
      >
        {children}
      </StaticBlockNoteEditor>
    )
  }

  if (session.isLoading || !session.doc || !session.provider) {
    return null
  }

  return (
    <CollaborativeBlockNoteEditor
      note={model.note}
      noteId={model.note._id}
      doc={session.doc}
      provider={session.provider}
      instanceId={session.instanceId}
      style={style}
      user={session.user}
      onEditorChange={onEditorChange}
    >
      {children}
    </CollaborativeBlockNoteEditor>
  )
}
