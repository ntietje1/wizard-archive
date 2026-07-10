import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { NoteContent } from '../content'
import type {
  NoteDocumentContentSource,
  EmbeddedNoteContentSource,
  NoteEmbedTargetContentSource,
  NoteLinkCreationSource,
  NoteLinkNavigationSource,
  NoteLinkResolutionSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from '../runtime'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useEditorDocState } from './editor-doc-state'
import type { EditorDocChangeHandler } from './editor-doc-state'
import type { NoteValueReferences, NoteValueRuntimeStateSource } from '../value-runtime-model'
import { useLocalScrollTop } from '../../rich-text/use-local-scroll-top'

export function EmbeddedNoteContent({
  note,
  editable,
  documentSource,
  embeddedNoteContentSource,
  embedTargetSource,
  linkCreationSource,
  linkNavigationSource,
  linkResolutionSource,
  noteValueReferences,
  noteValueStateSource,
  permissionSource,
  playbackSource,
  sharingSource,
  allowInnerScroll = true,
  constrained = false,
  isExclusivelySelected = false,
  textColor = null,
  wikiLinkSource,
  onEditorChange,
}: {
  note: NoteItemWithContent
  editable: boolean
  documentSource: NoteDocumentContentSource
  embeddedNoteContentSource: EmbeddedNoteContentSource
  embedTargetSource: NoteEmbedTargetContentSource
  linkCreationSource: NoteLinkCreationSource | null
  linkNavigationSource: NoteLinkNavigationSource | null
  linkResolutionSource: NoteLinkResolutionSource
  noteValueReferences: NoteValueReferences
  noteValueStateSource: NoteValueRuntimeStateSource
  permissionSource: NotePermissionContentSource
  playbackSource: NotePlaybackContentSource
  sharingSource: NoteSharingContentSource
  allowInnerScroll?: boolean
  constrained?: boolean
  isExclusivelySelected?: boolean
  textColor?: string | null
  wikiLinkSource: NoteWikiLinkContentSource
  onEditorChange?: EditorDocChangeHandler
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useLocalScrollTop(viewportRef)
  const textStyle = getEmbeddedNoteTextStyle(textColor)
  const maxPreviewHeight = constrained ? 'min(480px, 70vh)' : undefined
  const [{ doc, editor }, handleEditorChange] = useEditorDocState(onEditorChange)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || scrollTopRef.current <= 0) return

    const raf = requestAnimationFrame(() => {
      viewport.scrollTop = scrollTopRef.current
    })

    return () => cancelAnimationFrame(raf)
  }, [doc, editable, editor, scrollTopRef])

  return (
    <div
      className={cn(
        'note-editor-surface h-full',
        constrained && 'overflow-hidden',
        editable && 'nodrag nopan',
        isExclusivelySelected && 'nowheel',
      )}
      data-embedded-note-mode={editable ? 'editable' : 'readonly'}
      data-testid="embed-note-content-wrapper"
      style={{
        ...textStyle,
        ...(maxPreviewHeight ? { maxHeight: maxPreviewHeight } : {}),
      }}
    >
      <ScrollArea
        viewportRef={viewportRef}
        className="h-full"
        contentClassName="note-editor-scroll-content"
        scrollOrientation={allowInnerScroll ? 'vertical' : 'none'}
        viewportStyle={maxPreviewHeight ? { maxHeight: maxPreviewHeight } : undefined}
      >
        <NoteContent
          note={note}
          editable={editable}
          documentSource={documentSource}
          embeddedNoteContentSource={embeddedNoteContentSource}
          embedTargetSource={embedTargetSource}
          linkCreationSource={linkCreationSource}
          linkNavigationSource={linkNavigationSource}
          linkResolutionSource={linkResolutionSource}
          noteValueReferences={noteValueReferences}
          noteValueStateSource={noteValueStateSource}
          playbackSource={playbackSource}
          fillHeight
          permissionsSource={permissionSource}
          sharingSource={sharingSource}
          style={textStyle}
          wikiLinkSource={wikiLinkSource}
          onEditorChange={handleEditorChange}
        />
      </ScrollArea>
    </div>
  )
}

function getEmbeddedNoteTextStyle(textColor: string | null): CSSProperties {
  if (!textColor) return {}
  return {
    color: textColor,
    '--editor-text-color': textColor,
  } as CSSProperties
}
