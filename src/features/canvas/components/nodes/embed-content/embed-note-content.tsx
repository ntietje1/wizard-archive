import { useContext, useEffect, useState } from 'react'
import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/shadcn'
import { editorSchema } from 'convex/notes/editorSpecs'
import { CanvasContext } from '../../../utils/canvas-context'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Doc } from 'yjs'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { useConvexYjsCollaboration } from '~/features/editor/hooks/useConvexYjsCollaboration'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'
import {
  patchYSyncAfterTypeChanged,
  patchYUndoPluginDestroy,
} from '~/features/editor/utils/patch-yundo-destroy'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

export function EmbedNoteContent({ noteId }: { noteId: Id<'notes'> }) {
  const { user, canEdit } = useContext(CanvasContext)
  const { doc, provider, instanceId, isLoading } = useConvexYjsCollaboration(
    noteId,
    user,
    canEdit,
  )

  if (isLoading || !doc || !provider) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  return (
    <EmbedNoteEditor
      key={instanceId}
      doc={doc}
      provider={provider}
      canEdit={canEdit}
      user={user}
    />
  )
}

function EmbedNoteEditor({
  doc,
  provider,
  canEdit,
  user,
}: {
  doc: Doc
  provider: ConvexYjsProvider
  canEdit: boolean
  user: { name: string; color: string }
}) {
  const resolvedTheme = useResolvedTheme()
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)

  useEffect(() => {
    const instance = BlockNoteEditor.create({
      schema: editorSchema,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document'),
        user: { name: user.name, color: user.color },
        showCursorLabels: 'activity',
      },
    }) as CustomBlockNoteEditor

    setEditor(instance)

    let cancelled = false
    let retries = 0
    const MAX_RETRIES = 30
    const tryPatch = () => {
      if (cancelled) return
      if (instance._tiptapEditor.view.state.plugins.length === 0) {
        if (++retries >= MAX_RETRIES) return
        requestAnimationFrame(tryPatch)
        return
      }
      patchYUndoPluginDestroy(instance._tiptapEditor.view)
      patchYSyncAfterTypeChanged(instance._tiptapEditor.view)
    }
    requestAnimationFrame(tryPatch)

    return () => {
      cancelled = true
      instance._tiptapEditor.destroy()
    }
  }, [doc, provider])

  if (!editor) return null

  return (
    <div className="nodrag nopan nowheel h-full overflow-auto">
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme}
        editable={canEdit}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
      />
    </div>
  )
}
