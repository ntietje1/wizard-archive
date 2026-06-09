import { SideMenuExtension } from '@blocknote/core/extensions'
import { useExtension } from '@blocknote/react'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { File as FileIcon, Link } from 'lucide-react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
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
  areEmbedMediaLayoutsEqual,
  getEmbedMediaAspectRatio,
} from '~/features/embeds/utils/embed-media'
import {
  getDefaultDocumentEmbedAspectRatio,
  getDocumentEmbedAspectRatioForTarget,
} from '~/features/embeds/utils/document-embed-layout'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
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

const LiveEmbedContent = lazy(() =>
  import('~/features/embeds/components/live-embed-content').then((module) => ({
    default: module.LiveEmbedContent,
  })),
)
const SidebarItemPreviewRenderer = lazy(() =>
  import('./sidebar-item-preview-renderer').then((module) => ({
    default: module.SidebarItemPreviewRenderer,
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
  const pointerStartedInsideRef = useRef(false)
  const [selected, setSelected] = useState(false)
  const blockProps = block.props as NoteEmbedBlockProps
  const target = embedTargetFromBlockProps(blockProps)
  const layoutSeedKey = getNoteEmbedLayoutSeedKey(blockProps)
  const [reportedMediaLayout, setReportedMediaLayout] = useState<{
    layout: EmbedMediaLayout
    seedKey: string
  } | null>(null)
  const mediaLayout =
    reportedMediaLayout?.seedKey === layoutSeedKey
      ? reportedMediaLayout.layout
      : getInitialNoteEmbedMediaLayout(blockProps)
  const targetSidebarItemId =
    target.kind === 'sidebarItem'
      ? ((target.sidebarItemId as Id<'sidebarItems'> | undefined) ?? null)
      : null
  const [readySidebarItemId, setReadySidebarItemId] = useState<Id<'sidebarItems'> | null>(null)
  const sidebarPreviewReady =
    target.kind !== 'sidebarItem' || readySidebarItemId === targetSidebarItemId
  const { data: resolvedTargetItem } = useSidebarItemById(targetSidebarItemId)
  const documentAspectRatio = getDefaultDocumentEmbedAspectRatio({
    target,
    item: resolvedTargetItem ?? undefined,
  })
  const usesFreeformHeight = doesTargetUseFreeformNoteEmbedHeight(resolvedTargetItem)
  const maxHeightAspectRatio = getNoteEmbedMaxHeightAspectRatio({
    documentAspectRatio,
    resolvedTargetItem,
  })
  const effectiveMediaLayout =
    mediaLayout ?? (usesFreeformHeight ? null : getDocumentEmbedMediaLayout(documentAspectRatio))

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
  const height = clampNoteEmbedPreviewHeight(
    (usesFreeformHeight ? positiveNumber(blockProps.previewHeight) : undefined) ??
      getDefaultNoteEmbedPreviewHeight({
        aspectRatio: documentAspectRatio,
        usesFreeformHeight,
        width,
      }),
    { maxHeightAspectRatio, width },
  )

  const handleMediaLayout = (layout: EmbedMediaLayout) => {
    setReportedMediaLayout((currentLayout) =>
      currentLayout?.seedKey === layoutSeedKey &&
      areEmbedMediaLayoutsEqual(currentLayout.layout, layout)
        ? currentLayout
        : { layout, seedKey: layoutSeedKey },
    )
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

  useEffect(() => {
    if (target.kind !== 'sidebarItem') return

    const frame = requestAnimationFrame(() => setReadySidebarItemId(targetSidebarItemId))
    return () => cancelAnimationFrame(frame)
  }, [target.kind, targetSidebarItemId])

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
      data-note-embed-target-kind={target.kind}
      draggable={editable}
      className="note-embed-block allow-motion relative my-2 select-none overflow-visible"
      style={{
        width,
        maxWidth: '100%',
      }}
      onPointerDownCapture={(event) => {
        pointerStartedInsideRef.current = true
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
      onPointerUpCapture={(event) => {
        const startedInside = pointerStartedInsideRef.current
        pointerStartedInsideRef.current = false
        if (startedInside || !editable || event.button !== 0) return
        restoreTextRangeSelectionToEmbedBoundary(event.currentTarget)
      }}
      onPointerCancelCapture={() => {
        pointerStartedInsideRef.current = false
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
            allowInnerScroll={selected}
            height={height}
            mediaLayout={effectiveMediaLayout}
            rootRef={rootRef}
            sidebarPreviewReady={sidebarPreviewReady}
            sourceNoteId={sourceNoteId}
            target={target}
            onMediaLayout={handleMediaLayout}
            setTarget={setTarget}
          />
        ) : (
          <ReadOnlyNoteEmbedBlockBody
            allowInnerScroll={selected}
            height={height}
            mediaLayout={effectiveMediaLayout}
            sidebarPreviewReady={sidebarPreviewReady}
            sourceNoteId={sourceNoteId}
            target={target}
            onMediaLayout={handleMediaLayout}
          />
        )}
      </div>
      {editable && selected ? (
        <NoteEmbedResizeWrapper
          mediaLayout={effectiveMediaLayout}
          onResizeStart={(event, handle) => {
            startNoteEmbedResizeSession({
              aspectRatio: getNoteEmbedAspectRatio(effectiveMediaLayout),
              editorElement: editor.domElement,
              event,
              height,
              maxHeightAspectRatio,
              resizeHeight: usesFreeformHeight,
              root: rootRef.current,
              useMeasuredAspectRatioFallback: !usesFreeformHeight,
              width,
              handle,
              onCommit: ({ width: previewWidth, height: previewHeight }) => {
                editor.updateBlock(block, {
                  props: stripUndefined({
                    previewWidth,
                    previewHeight,
                  }),
                })
              },
            })
          }}
        />
      ) : null}
    </section>
  )
}

function restoreTextRangeSelectionToEmbedBoundary(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection()
  const anchorNode = selection?.anchorNode
  if (!selection?.isCollapsed || anchorNode?.nodeType !== Node.TEXT_NODE) return

  const anchorElement = anchorNode.parentElement
  if (!anchorElement?.closest('.bn-editor') || anchorElement.closest('.note-embed-block')) {
    return
  }

  const blockContent = root.closest<HTMLElement>('[data-content-type="embed"]')
  const blockBoundary = root.closest<HTMLElement>('[data-node-type="blockOuter"]') ?? blockContent
  if (!blockContent || !blockBoundary) return

  const anchorComesBeforeEmbed =
    anchorNode.compareDocumentPosition(blockContent) & Node.DOCUMENT_POSITION_FOLLOWING
  const range = root.ownerDocument.createRange()
  if (anchorComesBeforeEmbed) {
    range.setStart(anchorNode, selection.anchorOffset)
    range.setEndAfter(blockBoundary)
  } else {
    range.setStartBefore(blockBoundary)
    range.setEnd(anchorNode, selection.anchorOffset)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

function ReadOnlyNoteEmbedBlockBody({
  allowInnerScroll,
  height,
  mediaLayout,
  onMediaLayout,
  sidebarPreviewReady,
  sourceNoteId,
  target,
}: {
  allowInnerScroll: boolean
  height: number | undefined
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
  sidebarPreviewReady: boolean
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
}) {
  return (
    <div
      data-note-embed-body="true"
      className={getNoteEmbedBodyClassName(mediaLayout)}
      style={getNoteEmbedBodyStyle(mediaLayout, height)}
    >
      <Suspense fallback={<EmbedLoadingState />}>
        {sidebarPreviewReady ? (
          <LiveEmbedContent
            target={target}
            sourceItemId={sourceNoteId}
            mode="readonly"
            allowInnerScroll={allowInnerScroll}
            onMediaLayout={onMediaLayout}
            SidebarItemRenderer={SidebarItemPreviewRenderer}
          />
        ) : (
          <EmbedLoadingState />
        )}
      </Suspense>
    </div>
  )
}

function EditableNoteEmbedBlockBody({
  allowInnerScroll,
  height,
  mediaLayout,
  rootRef,
  sidebarPreviewReady,
  sourceNoteId,
  target,
  onMediaLayout,
  setTarget,
}: {
  allowInnerScroll: boolean
  height: number | undefined
  mediaLayout: EmbedMediaLayout | null
  rootRef: RefObject<HTMLElement | null>
  sidebarPreviewReady: boolean
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
  onMediaLayout: (layout: EmbedMediaLayout) => void
  setTarget: (target: EmbedTarget) => void
}) {
  const embedControls = useEditableEmbedTargetControls({ setTarget })

  const dropVisualState = useEmbedDropTarget({
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
        style={getNoteEmbedBodyStyle(mediaLayout, height)}
      >
        <Suspense fallback={<EmbedLoadingState />}>
          {sidebarPreviewReady ? (
            <LiveEmbedContent
              target={target}
              sourceItemId={sourceNoteId}
              mode="editable"
              onUpload={embedControls.openFilePicker}
              onLinkExternal={embedControls.openLinkDraft}
              allowInnerScroll={allowInnerScroll}
              onMediaLayout={onMediaLayout}
              dropVisualState={target.kind === 'empty' ? dropVisualState : undefined}
              SidebarItemRenderer={SidebarItemPreviewRenderer}
            />
          ) : (
            <EmbedLoadingState />
          )}
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
  return getEmbedMediaAspectRatio(mediaLayout)
}

function getInitialNoteEmbedMediaLayout(props: NoteEmbedBlockProps): EmbedMediaLayout | null {
  const aspectRatio =
    positiveNumber(props.previewAspectRatio) ??
    getDocumentEmbedAspectRatioForTarget(embedTargetFromBlockProps(props))
  return aspectRatio ? { kind: 'intrinsicAspectRatio', aspectRatio } : null
}

function getDocumentEmbedMediaLayout(aspectRatio: number | null): EmbedMediaLayout | null {
  return aspectRatio ? { kind: 'intrinsicAspectRatio', aspectRatio } : null
}

function getNoteEmbedLayoutSeedKey(props: NoteEmbedBlockProps) {
  return [
    props.targetKind ?? 'empty',
    props.sidebarItemId ?? '',
    props.url ?? '',
    props.previewHeight ?? '',
    props.previewAspectRatio ?? '',
  ].join(':')
}

function getNoteEmbedBodyClassName(mediaLayout: EmbedMediaLayout | null) {
  return cn(
    'w-full min-w-full overflow-hidden',
    mediaLayout?.kind === 'fixedHeight' ? 'h-auto' : 'min-h-36',
  )
}

function getNoteEmbedBodyStyle(
  mediaLayout: EmbedMediaLayout | null,
  height: number | undefined,
): CSSProperties | undefined {
  if (mediaLayout?.kind === 'fixedHeight') {
    return { height: mediaLayout.height }
  }

  const aspectRatio = getNoteEmbedAspectRatio(mediaLayout)
  if (aspectRatio) return { aspectRatio: `${aspectRatio} / 1` }
  return height ? { height } : undefined
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
    previewHeight: props.previewHeight,
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

function doesTargetUseFreeformNoteEmbedHeight(
  resolvedTargetItem: { type?: unknown } | null | undefined,
) {
  return (
    resolvedTargetItem?.type === SIDEBAR_ITEM_TYPES.notes ||
    resolvedTargetItem?.type === SIDEBAR_ITEM_TYPES.canvases
  )
}

function getDefaultNoteEmbedPreviewHeight({
  aspectRatio,
  usesFreeformHeight,
  width,
}: {
  aspectRatio: number | null
  usesFreeformHeight: boolean
  width: number | undefined
}) {
  if (!usesFreeformHeight || !aspectRatio || !width) return undefined
  return Math.round(width / aspectRatio)
}

function getNoteEmbedMaxHeightAspectRatio({
  documentAspectRatio,
  resolvedTargetItem,
}: {
  documentAspectRatio: number | null
  resolvedTargetItem: { type?: unknown } | null | undefined
}) {
  return resolvedTargetItem?.type === SIDEBAR_ITEM_TYPES.canvases ? documentAspectRatio : null
}

function clampNoteEmbedPreviewHeight(
  height: number | undefined,
  {
    maxHeightAspectRatio,
    width,
  }: {
    maxHeightAspectRatio: number | null
    width: number | undefined
  },
) {
  if (!height || !width || !maxHeightAspectRatio) return height
  return Math.round(Math.min(height, width / maxHeightAspectRatio))
}
