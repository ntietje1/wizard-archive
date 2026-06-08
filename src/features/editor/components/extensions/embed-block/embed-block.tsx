import { SideMenuExtension } from '@blocknote/core/extensions'
import { useExtension } from '@blocknote/react'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { File as FileIcon, Link } from 'lucide-react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { Id } from 'convex/_generated/dataModel'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useEditableEmbedTargetControls } from '~/features/embeds/hooks/use-editable-embed-target-controls'
import { EmbedLoadingState } from '~/features/embeds/components/embed-loading-state'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { cn } from '~/features/shadcn/lib/utils'
import {
  RESIZE_HANDLE_DESCRIPTORS,
  getResizeHandleLabel,
} from 'shared/resize/resizeHandleDescriptors'
import { useEmbedDropTarget } from '~/features/embeds/hooks/use-embed-drop-target'
import type { EmbedMediaLayout } from '~/features/embeds/utils/embed-media'
import {
  DEFAULT_NOTE_EMBED_PREVIEW_WIDTH,
  blockPropsFromEmbedTarget,
  embedTargetFromBlockProps,
} from './embed-block-targets'
import { getNoteEmbedResizeCursor, startNoteEmbedResizeSession } from './note-embed-resize'
import type { NoteEmbedResizeHandle } from './note-embed-resize'
import type { NoteEmbedBlockProps } from './embed-block-targets'
import {
  clearInternalNativeDrag,
  isInternalNativeDrag,
  markInternalNativeDrag,
} from '~/features/dnd/utils/internal-native-drag'
import { SidebarItemPreviewRenderer } from './sidebar-item-preview-renderer'

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
  const sideMenu = useExtension(SideMenuExtension)
  const rootRef = useRef<HTMLElement | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const mediaControlDragSuppressionRef = useRef(false)
  const mediaControlDragSuppressionCleanupRef = useRef<(() => void) | null>(null)
  const [selected, setSelected] = useState(false)
  const blockProps = block.props as NoteEmbedBlockProps
  const [mediaLayout, setMediaLayout] = useState<EmbedMediaLayout | null>(() =>
    getInitialNoteEmbedMediaLayout(blockProps),
  )
  const target = embedTargetFromBlockProps(blockProps)
  const layoutSeedKey = getNoteEmbedLayoutSeedKey(blockProps)
  const layoutSeedKeyRef = useRef(layoutSeedKey)

  const setTarget = (nextTarget: EmbedTarget) => {
    const nextProps = {
      ...getSharedEmbedBlockProps(blockProps),
      ...(nextTarget.kind !== 'empty' && !positiveNumber(blockProps.previewWidth)
        ? { previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH }
        : {}),
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

  const width =
    positiveNumber(blockProps.previewWidth) ??
    (target.kind !== 'empty' ? DEFAULT_NOTE_EMBED_PREVIEW_WIDTH : undefined)

  const handleMediaLayout = (layout: EmbedMediaLayout) => {
    setMediaLayout(layout)
    if (!editable) return

    const aspectRatio = getNoteEmbedAspectRatio(layout)
    if (!aspectRatio || blockProps.previewAspectRatio === aspectRatio) return

    editor.updateBlock(block, {
      props: {
        previewAspectRatio: aspectRatio,
      },
    })
  }

  useEffect(() => {
    if (layoutSeedKeyRef.current === layoutSeedKey) return
    layoutSeedKeyRef.current = layoutSeedKey
    setMediaLayout(getInitialNoteEmbedMediaLayout(blockProps))
  }, [blockProps, layoutSeedKey])

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

  useEffect(
    () => () => {
      mediaControlDragSuppressionCleanupRef.current?.()
    },
    [],
  )

  const selectEmbed = () => {
    setSelected(true)
    editor.setTextCursorPosition?.(block, 'start')
  }

  const finishSurfaceDrag = () => {
    const cleanup = dragCleanupRef.current
    if (cleanup) {
      cleanup()
      return
    }

    sideMenu.blockDragEnd()
    clearInternalNativeDrag()
  }

  const registerSurfaceDragCleanup = (view: Window | null) => {
    dragCleanupRef.current?.()
    if (!view) return

    const cleanup = () => {
      view.removeEventListener('dragend', cleanup, true)
      view.removeEventListener('drop', cleanup, true)
      dragCleanupRef.current = null
      sideMenu.blockDragEnd()
      clearInternalNativeDrag()
    }

    dragCleanupRef.current = cleanup
    view.addEventListener('dragend', cleanup, true)
    view.addEventListener('drop', cleanup, true)
  }

  const suppressSurfaceDragForMediaControlPointer = (view: Window | null) => {
    mediaControlDragSuppressionCleanupRef.current?.()
    mediaControlDragSuppressionRef.current = true

    if (!view) return

    const cleanup = () => {
      view.removeEventListener('pointerup', cleanup, true)
      view.removeEventListener('pointercancel', cleanup, true)
      mediaControlDragSuppressionRef.current = false
      mediaControlDragSuppressionCleanupRef.current = null
    }

    mediaControlDragSuppressionCleanupRef.current = cleanup
    view.addEventListener('pointerup', cleanup, true)
    view.addEventListener('pointercancel', cleanup, true)
  }

  return (
    <section
      ref={rootRef}
      data-testid="note-embed-block"
      data-note-embed-drop-target="true"
      draggable={editable}
      className="note-embed-block allow-motion relative my-2 select-none overflow-visible"
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
        if (isEmbedMediaControlEventTarget(eventTarget)) {
          suppressSurfaceDragForMediaControlPointer(event.currentTarget.ownerDocument.defaultView)
          return
        }
        selectEmbed()
      }}
      onDragStart={(event) => {
        if (event.defaultPrevented) return
        if (
          mediaControlDragSuppressionRef.current ||
          isEmbedMediaControlEventTarget(event.target)
        ) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        markInternalNativeDrag(event.dataTransfer)
        sideMenu.blockDragStart(event, block as never)
        registerSurfaceDragCleanup(event.currentTarget.ownerDocument.defaultView)
      }}
      onDragEnd={finishSurfaceDrag}
      onDropCapture={(event) => {
        if (isInternalNativeDrag(event.dataTransfer)) {
          event.preventDefault()
        }
      }}
    >
      <div
        data-testid="note-embed-visual-surface"
        contentEditable={false}
        draggable={false}
        className={cn(
          'w-full select-none overflow-hidden border border-border bg-card text-card-foreground',
          target.kind === 'empty' && 'border-dashed bg-muted/20',
        )}
      >
        {target.kind !== 'empty' ? <NoteEmbedBlockHeader target={target} /> : null}
        {editable ? (
          <EditableNoteEmbedBlockBody
            mediaLayout={mediaLayout}
            rootRef={rootRef}
            sourceNoteId={sourceNoteId}
            target={target}
            onMediaLayout={handleMediaLayout}
            setTarget={setTarget}
          />
        ) : (
          <ReadOnlyNoteEmbedBlockBody
            mediaLayout={mediaLayout}
            sourceNoteId={sourceNoteId}
            target={target}
            onMediaLayout={handleMediaLayout}
          />
        )}
      </div>
      {editable && selected ? (
        <NoteEmbedResizeWrapper
          mediaLayout={mediaLayout}
          onResizeStart={(event, handle) => {
            startNoteEmbedResizeSession({
              aspectRatio: getNoteEmbedAspectRatio(mediaLayout),
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
    </section>
  )
}

function ReadOnlyNoteEmbedBlockBody({
  mediaLayout,
  onMediaLayout,
  sourceNoteId,
  target,
}: {
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
}) {
  return (
    <div
      className={getNoteEmbedBodyClassName(mediaLayout)}
      style={getNoteEmbedBodyStyle(mediaLayout)}
    >
      <Suspense fallback={<EmbedLoadingState />}>
        <EmbedContent
          target={target}
          sourceItemId={sourceNoteId}
          mode="readonly"
          onMediaLayout={onMediaLayout}
          SidebarItemRenderer={SidebarItemPreviewRenderer}
        />
      </Suspense>
    </div>
  )
}

function EditableNoteEmbedBlockBody({
  mediaLayout,
  rootRef,
  sourceNoteId,
  target,
  onMediaLayout,
  setTarget,
}: {
  mediaLayout: EmbedMediaLayout | null
  rootRef: RefObject<HTMLElement | null>
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
  onMediaLayout: (layout: EmbedMediaLayout) => void
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
        className={getNoteEmbedBodyClassName(mediaLayout)}
        style={getNoteEmbedBodyStyle(mediaLayout)}
      >
        <Suspense fallback={<EmbedLoadingState />}>
          <EmbedContent
            target={target}
            sourceItemId={sourceNoteId}
            mode="editable"
            onUpload={embedControls.openFilePicker}
            onLinkExternal={embedControls.openLinkDraft}
            onMediaLayout={onMediaLayout}
            SidebarItemRenderer={SidebarItemPreviewRenderer}
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
  mediaLayout,
  onResizeStart,
}: {
  mediaLayout: EmbedMediaLayout | null
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
      <NoteEmbedResizeHandles mediaLayout={mediaLayout} onResizeStart={onResizeStart} />
    </div>
  )
}

function NoteEmbedResizeHandles({
  mediaLayout,
  onResizeStart,
}: {
  mediaLayout: EmbedMediaLayout | null
  onResizeStart: (event: ReactPointerEvent<HTMLElement>, handle: NoteEmbedResizeHandle) => void
}) {
  return (
    <>
      {getNoteEmbedResizeHandleDescriptors(mediaLayout).map(({ position, cursorClassName }) => (
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
            mediaLayout?.kind !== 'fixedHeight' && getNoteEmbedResizeZoneClassName(position),
            cursorClassName,
          )}
          style={getNoteEmbedResizeZoneStyle(position, mediaLayout)}
          onPointerDown={(event) => onResizeStart(event, position)}
        />
      ))}
    </>
  )
}

function getNoteEmbedResizeHandleDescriptors(mediaLayout: EmbedMediaLayout | null) {
  const descriptors: Array<(typeof RESIZE_HANDLE_DESCRIPTORS)[number]> = []
  for (const descriptor of RESIZE_HANDLE_DESCRIPTORS) {
    if (isNoteEmbedResizeHandleAllowed(descriptor.position, mediaLayout)) {
      descriptors.push(descriptor)
    }
  }
  return descriptors
}

function getNoteEmbedResizeZoneStyle(
  position: NoteEmbedResizeHandle,
  mediaLayout: EmbedMediaLayout | null,
): CSSProperties {
  const cursor = getNoteEmbedResizeCursor(position)
  if (mediaLayout?.kind !== 'fixedHeight') {
    return { cursor }
  }

  if (position === 'left') {
    return { bottom: 0, cursor, left: -9, top: 0, width: 18 }
  }

  return { bottom: 0, cursor, right: -9, top: 0, width: 18 }
}

function getNoteEmbedAspectRatio(mediaLayout: EmbedMediaLayout | null) {
  if (
    mediaLayout?.kind === 'intrinsicAspectRatio' &&
    typeof mediaLayout.aspectRatio === 'number' &&
    Number.isFinite(mediaLayout.aspectRatio) &&
    mediaLayout.aspectRatio > 0
  ) {
    return mediaLayout.aspectRatio
  }

  return null
}

function getInitialNoteEmbedMediaLayout(props: NoteEmbedBlockProps): EmbedMediaLayout | null {
  const aspectRatio = positiveNumber(props.previewAspectRatio)
  return aspectRatio ? { kind: 'intrinsicAspectRatio', aspectRatio } : null
}

function getNoteEmbedLayoutSeedKey(props: NoteEmbedBlockProps) {
  return [
    props.targetKind ?? 'empty',
    props.sidebarItemId ?? '',
    props.url ?? '',
    props.previewAspectRatio ?? '',
  ].join(':')
}

function getNoteEmbedBodyClassName(mediaLayout: EmbedMediaLayout | null) {
  return cn(
    'w-full min-w-full overflow-hidden',
    mediaLayout?.kind === 'fixedHeight' ? 'h-auto' : 'min-h-36',
  )
}

function getNoteEmbedBodyStyle(mediaLayout: EmbedMediaLayout | null): CSSProperties | undefined {
  if (mediaLayout?.kind === 'fixedHeight') {
    return { height: mediaLayout.height }
  }

  const aspectRatio = getNoteEmbedAspectRatio(mediaLayout)
  return aspectRatio ? { aspectRatio: `${aspectRatio} / 1` } : undefined
}

function isNoteEmbedResizeHandleAllowed(
  position: NoteEmbedResizeHandle,
  mediaLayout: EmbedMediaLayout | null,
) {
  if (mediaLayout?.kind !== 'fixedHeight') {
    return true
  }

  return position === 'left' || position === 'right'
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

function isEmbedMediaControlEventTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest('[data-embed-media-control="true"]')
}
