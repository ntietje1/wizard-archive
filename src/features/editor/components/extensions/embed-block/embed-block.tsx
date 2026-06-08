import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { File as FileIcon, Link } from 'lucide-react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { Id } from 'convex/_generated/dataModel'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useEditableEmbedTargetControls } from '~/features/embeds/hooks/use-editable-embed-target-controls'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { cn } from '~/features/shadcn/lib/utils'
import {
  RESIZE_HANDLE_DESCRIPTORS,
  getResizeHandleLabel,
} from 'shared/resize/resizeHandleDescriptors'
import { useEmbedDropTarget } from '~/features/embeds/hooks/use-embed-drop-target'
import { blockPropsFromEmbedTarget, embedTargetFromBlockProps } from './embed-block-targets'
import { getNoteEmbedResizeCursor, startNoteEmbedResizeSession } from './note-embed-resize'
import type { NoteEmbedResizeHandle } from './note-embed-resize'
import type { NoteEmbedBlockProps } from './embed-block-targets'

const EmbedContent = lazy(() =>
  import('~/features/embeds/components/embed-content').then((module) => ({
    default: module.EmbedContent,
  })),
)

type NoteEmbedBlockViewProps = {
  block: {
    children?: Array<unknown>
    content?: unknown
    props: NoteEmbedBlockProps
  }
  editable: boolean
  editor: {
    domElement?: HTMLElement | null
    replaceBlocks: (blocksToRemove: Array<unknown>, blocksToInsert: Array<unknown>) => void
    setTextCursorPosition?: (targetBlock: unknown, placement?: 'start' | 'end') => void
    updateBlock: (block: unknown, update: unknown) => void
  }
  sourceNoteId: Id<'sidebarItems'> | null
}

export function NoteEmbedBlockView({
  block,
  editor,
  editable,
  sourceNoteId,
}: NoteEmbedBlockViewProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const [intrinsicAspectRatio, setIntrinsicAspectRatio] = useState<number | null>(null)
  const [selected, setSelected] = useState(false)
  const blockProps = block.props as NoteEmbedBlockProps
  const target = embedTargetFromBlockProps(blockProps)

  const setTarget = (nextTarget: EmbedTarget) => {
    const nextProps = {
      ...getSharedEmbedBlockProps(blockProps),
      ...blockPropsFromEmbedTarget(nextTarget),
    }

    editor.replaceBlocks(
      [block],
      [
        {
          ...block,
          props: nextProps,
        },
      ],
    )
  }

  const width = positiveNumber(blockProps.previewWidth)

  useEffect(() => {
    if (!selected) return

    const clearSelectionOutsideEmbed = (event: PointerEvent) => {
      const eventTarget = event.target
      if (eventTarget instanceof Node && rootRef.current?.contains(eventTarget)) return
      setSelected(false)
    }

    window.addEventListener('pointerdown', clearSelectionOutsideEmbed, true)
    return () => window.removeEventListener('pointerdown', clearSelectionOutsideEmbed, true)
  }, [selected])

  const selectEmbed = () => {
    setSelected(true)
    editor.setTextCursorPosition?.(block, 'start')
  }

  return (
    <section
      ref={rootRef}
      data-testid="note-embed-block"
      data-note-embed-drop-target="true"
      className="note-embed-block allow-motion relative my-2 overflow-visible"
      style={{
        width,
        maxWidth: '100%',
      }}
      onPointerDownCapture={(event) => {
        if (!editable || event.button !== 0) return
        const eventTarget = event.target
        if (
          eventTarget instanceof Element &&
          eventTarget.closest('[data-note-embed-resize-zone="true"]')
        ) {
          return
        }
        selectEmbed()
      }}
    >
      <div
        data-testid="note-embed-visual-surface"
        contentEditable={false}
        draggable={false}
        className={cn(
          'w-full overflow-hidden border border-border bg-card text-card-foreground',
          target.kind === 'empty' && 'border-dashed bg-muted/20',
        )}
      >
        {target.kind !== 'empty' ? <NoteEmbedBlockHeader target={target} /> : null}
        {editable ? (
          <EditableNoteEmbedBlockBody
            aspectRatio={intrinsicAspectRatio}
            rootRef={rootRef}
            sourceNoteId={sourceNoteId}
            target={target}
            onIntrinsicAspectRatio={(aspectRatio) => {
              setIntrinsicAspectRatio(aspectRatio)
            }}
            setTarget={setTarget}
          />
        ) : (
          <ReadOnlyNoteEmbedBlockBody sourceNoteId={sourceNoteId} target={target} />
        )}
      </div>
      {editable && selected ? (
        <NoteEmbedResizeWrapper
          onResizeStart={(event, handle) => {
            startNoteEmbedResizeSession({
              aspectRatio: intrinsicAspectRatio,
              editorElement: editor.domElement,
              event,
              root: rootRef.current,
              width,
              handle,
              onCommit: (previewWidth) => {
                editor.updateBlock(block, {
                  props: {
                    previewWidth,
                  },
                })
              },
            })
          }}
        />
      ) : null}
      {editable && target.kind !== 'empty' && !selected ? (
        <div
          aria-hidden="true"
          data-testid="note-embed-select-layer"
          className="note-embed-select-layer absolute inset-0 z-10 bg-transparent"
        />
      ) : null}
    </section>
  )
}

function ReadOnlyNoteEmbedBlockBody({
  sourceNoteId,
  target,
}: {
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
}) {
  return (
    <div className="min-h-36">
      <Suspense fallback={<div className="min-h-36" />}>
        <EmbedContent
          target={target}
          sourceItemId={sourceNoteId}
          mode="readonly"
          renderSidebarItem={(item) => <SidebarItemPreviewContent item={item} />}
        />
      </Suspense>
    </div>
  )
}

function EditableNoteEmbedBlockBody({
  aspectRatio,
  rootRef,
  sourceNoteId,
  target,
  onIntrinsicAspectRatio,
  setTarget,
}: {
  aspectRatio: number | null
  rootRef: RefObject<HTMLElement | null>
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
  onIntrinsicAspectRatio: (aspectRatio: number | null) => void
  setTarget: (target: EmbedTarget) => void
}) {
  const embedControls = useEditableEmbedTargetControls({ setTarget })

  useEmbedDropTarget({
    ref: rootRef,
    enabled: true,
    sourceItemId: sourceNoteId,
    setTarget: embedControls.setTargetAndCloseDraft,
    uploadFile: embedControls.uploadFile,
  })

  return (
    <>
      <div
        data-note-embed-body="true"
        className="min-h-36 w-full"
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <Suspense fallback={<div className="min-h-36" />}>
          <EmbedContent
            target={target}
            sourceItemId={sourceNoteId}
            mode="editable"
            onUpload={embedControls.openFilePicker}
            onLinkExternal={embedControls.openLinkDraft}
            onIntrinsicAspectRatio={onIntrinsicAspectRatio}
            renderSidebarItem={(item) => <SidebarItemPreviewContent item={item} />}
          />
        </Suspense>
      </div>
      <input
        ref={embedControls.fileInputRef}
        type="file"
        aria-label="Embed file upload"
        className="hidden"
        onChange={embedControls.handleFileInputChange}
      />
      {embedControls.isUploading || embedControls.uploadError ? (
        <div className="border-t border-border px-3 py-2 text-sm">
          {embedControls.uploadError ? (
            <span className="text-destructive">{embedControls.uploadError}</span>
          ) : (
            <span className="text-muted-foreground">Uploading...</span>
          )}
        </div>
      ) : null}
      {embedControls.linkDraftOpen ? (
        <form
          className="flex gap-2 border-t border-border p-2"
          action={embedControls.submitLinkDraft}
        >
          <Input
            value={embedControls.linkDraft}
            aria-label="External file URL"
            placeholder="https://example.com/file.pdf"
            onChange={(event) => {
              embedControls.setLinkDraftValue(event.target.value)
            }}
          />
          <Button type="submit" size="sm">
            Link
          </Button>
          {embedControls.linkError ? (
            <span className="self-center text-sm text-destructive">{embedControls.linkError}</span>
          ) : null}
        </form>
      ) : null}
    </>
  )
}

function NoteEmbedBlockHeader({ target }: { target: EmbedTarget }) {
  const title = getTargetTitle(target)
  if (!title) return null
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
      {target.kind === 'externalUrl' ? (
        <Link className="size-4 text-muted-foreground" />
      ) : (
        <FileIcon className="size-4 text-muted-foreground" />
      )}
      <h3 className="min-w-0 truncate text-sm font-medium">{title}</h3>
    </div>
  )
}

const NOTE_EMBED_SELECTION_CHROME_OUTSET_PX = 3
const NOTE_EMBED_SELECTION_CHROME_STROKE_WIDTH_PX = 1.5

function NoteEmbedResizeWrapper({
  onResizeStart,
}: {
  onResizeStart: (event: ReactPointerEvent<HTMLElement>, handle: NoteEmbedResizeHandle) => void
}) {
  return (
    <div
      data-testid="note-embed-resize-wrapper"
      contentEditable={false}
      draggable={false}
      className="note-embed-resize-wrapper pointer-events-none absolute left-0 top-0 z-30 h-full w-full"
    >
      <div
        data-testid="note-embed-resize-fill"
        className="pointer-events-none absolute inset-0 bg-canvas-selection-fill"
      />
      <div
        data-testid="note-embed-resize-outline"
        className="pointer-events-none absolute"
        style={{
          borderColor: 'var(--canvas-selection-stroke)',
          borderStyle: 'solid',
          borderWidth: NOTE_EMBED_SELECTION_CHROME_STROKE_WIDTH_PX,
          inset: -NOTE_EMBED_SELECTION_CHROME_OUTSET_PX,
        }}
      />
      <NoteEmbedResizeHandles onResizeStart={onResizeStart} />
    </div>
  )
}

function NoteEmbedResizeHandles({
  onResizeStart,
}: {
  onResizeStart: (event: ReactPointerEvent<HTMLElement>, handle: NoteEmbedResizeHandle) => void
}) {
  return (
    <>
      {RESIZE_HANDLE_DESCRIPTORS.map(({ position, cursorClassName }) => (
        <button
          key={position}
          type="button"
          tabIndex={-1}
          draggable={false}
          aria-label={getResizeHandleLabel(position)}
          data-testid={`note-embed-resize-zone-${position}`}
          data-note-embed-resize-zone="true"
          className={cn(
            'note-embed-resize-zone pointer-events-auto absolute z-20 border-0 bg-transparent p-0 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-selection-focus-ring focus-visible:ring-offset-0',
            getNoteEmbedResizeZoneClassName(position),
            cursorClassName,
          )}
          style={{ cursor: getNoteEmbedResizeCursor(position) }}
          onPointerDown={(event) => onResizeStart(event, position)}
        />
      ))}
    </>
  )
}

function getNoteEmbedResizeZoneClassName(handle: NoteEmbedResizeHandle) {
  switch (handle) {
    case 'top-left':
      return '-left-1 -top-1 size-3'
    case 'top':
      return '-top-1 inset-x-3 h-2'
    case 'top-right':
      return '-right-1 -top-1 size-3'
    case 'right':
      return '-right-1 inset-y-3 w-2'
    case 'bottom-right':
      return '-bottom-1 -right-1 size-3'
    case 'bottom':
      return '-bottom-1 inset-x-3 h-2'
    case 'bottom-left':
      return '-bottom-1 -left-1 size-3'
    case 'left':
      return '-left-1 inset-y-3 w-2'
  }
}

function getTargetTitle(target: EmbedTarget) {
  if (target.kind === 'externalUrl') return target.name ?? target.url
  return null
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function getSharedEmbedBlockProps(props: NoteEmbedBlockProps): NoteEmbedBlockProps {
  return stripUndefined({
    backgroundColor: props.backgroundColor,
    textAlignment: props.textAlignment,
    previewWidth: props.previewWidth,
  })
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T
}
