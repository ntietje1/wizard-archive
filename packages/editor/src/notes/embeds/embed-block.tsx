import { SideMenuExtension } from '@blocknote/core/extensions'
import { useExtension } from '@blocknote/react'
import { use, useEffect, useRef, useState } from 'react'
import { File as FileIcon, Link } from 'lucide-react'
import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItemWithContent } from '../../workspace/items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  ReactNode,
} from 'react'
import { useEditableEmbedTargetControls } from '../../embeds/hooks/use-editable-target-controls'
import { EmbedContent } from '../../embeds/components/embed-content'
import { EmbedLoadingState } from '../../embeds/components/embed-loading-state'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import {
  EditableEmbedLinkDraftForm,
  EditableEmbedUploadStatus,
} from '../../embeds/components/editable-target-controls'
import {
  RESIZE_HANDLE_DESCRIPTORS,
  getResizeHandleLabel,
} from '../../../../../shared/resize/resizeHandleDescriptors'
import type { ResizeHandlePosition } from '../../../../../shared/resize/resizeHandleDescriptors'
import { useEmbedDropTarget } from '../../embeds/hooks/use-drop-target'
import { usePendingEmbedUpload } from '../../embeds/pending-upload'
import { getPositiveFiniteNumber } from './numbers'
import type { EmbedMediaLayout } from '../../embeds/utils/media'
import { areEmbedMediaLayoutsEqual, getEmbedMediaAspectRatio } from '../../embeds/utils/media'
import type { EmbeddedNotePreviewRenderer } from './embedded-note-preview-renderer'
import {
  getDefaultDocumentEmbedAspectRatio,
  getDocumentEmbedAspectRatioForTarget,
} from '../../embeds/utils/document-layout'
import { useResourceContentState } from '../../filesystem/resource-content-context'
import type { ResourceContentState } from '../../filesystem/resource-content-source'
import {
  DEFAULT_NOTE_EMBED_PREVIEW_WIDTH,
  blockPropsFromEmbedTarget,
  embedTargetFromBlockProps,
} from './block-targets'
import {
  getNoteEmbedKeyboardResize,
  getNoteEmbedResizeCursor,
  startNoteEmbedResizeSession,
} from './resize'
import type { NoteEmbedBlockProps } from './block-targets'
import { useNoteEmbedSurface } from './surface-context-value'
import {
  clearInternalNativeDrag,
  isInternalNativeDrag,
  markInternalNativeDrag,
} from '@wizard-archive/ui/drag-drop/internal-native-drag'
import { BlockNoteContextMenuContext } from '../context-menu/blocknote-context-menu'

type NoteEmbedBlockViewProps = {
  block: {
    children?: Array<unknown>
    content?: unknown
    id: string
    props: NoteEmbedBlockProps
  }
  editable: boolean
  editor: {
    domElement?: HTMLElement | null
    replaceBlocks: (blocksToRemove: Array<unknown>, blocksToInsert: Array<unknown>) => void
    extendTextSelectionToBlockBoundary?: (targetBlockId: string) => void
    setTextCursorPosition?: (targetBlock: unknown, placement?: 'start' | 'end') => void
    updateBlock: (block: unknown, update: unknown) => void
  }
  sourceNoteId: SidebarItemId | null
}

type ResolvedNoteEmbedBlockViewProps = NoteEmbedBlockViewProps & {
  blockProps: NoteEmbedBlockProps
  resolvedTargetItem: AnyItemWithContent | null
  resolvedSidebarItemState: ResourceContentState | undefined
  target: EmbedTarget
}

type ReportedNoteEmbedMediaLayout = {
  layout: EmbedMediaLayout
  seedKey: string
}

type NoteEmbedVisualSurfaceProps = {
  editable: boolean
  embedBlockId: string
  height: number | undefined
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
  rootRef: RefObject<HTMLElement | null>
  selected: boolean
  setTarget: (target: EmbedTarget) => void
  sidebarPreviewReady: boolean
  resolvedSidebarItemState: ResourceContentState | undefined
  sourceNoteId: SidebarItemId | null
  target: EmbedTarget
}

type NoteEmbedBlockBodyContentProps = Omit<
  NoteEmbedVisualSurfaceProps,
  'editable' | 'embedBlockId' | 'rootRef' | 'selected' | 'setTarget'
> & {
  allowInnerScroll: boolean
}

type EditableNoteEmbedBlockBodyProps = NoteEmbedBlockBodyContentProps &
  Pick<NoteEmbedVisualSurfaceProps, 'embedBlockId' | 'rootRef' | 'setTarget'>

type EditableNoteEmbedControls = ReturnType<typeof useEditableEmbedTargetControls>
type NoteEmbedBlockFrameProps = {
  children: ReactNode
  editable: boolean
  rootRef: RefObject<HTMLElement | null>
  selection: ReturnType<typeof useNoteEmbedPointerSelection>
  surfaceDrag: ReturnType<typeof useNoteEmbedSurfaceDrag>
  target: EmbedTarget
  width: number | undefined
}
type NoteEmbedSideMenu = {
  blockDragStart: (event: ReactDragEvent<HTMLElement>, block: never) => void
  blockDragEnd: () => void
}

export function NoteEmbedBlockView({
  block,
  editor,
  editable,
  sourceNoteId,
}: NoteEmbedBlockViewProps) {
  const blockProps = block.props as NoteEmbedBlockProps
  const target = embedTargetFromBlockProps(blockProps)

  if (target.kind === 'resource') {
    return (
      <ResourceNoteEmbedBlockView
        block={block}
        blockProps={blockProps}
        editor={editor}
        editable={editable}
        sourceNoteId={sourceNoteId}
        target={target}
      />
    )
  }

  return (
    <ResolvedNoteEmbedBlockView
      block={block}
      blockProps={blockProps}
      editor={editor}
      editable={editable}
      resolvedTargetItem={null}
      resolvedSidebarItemState={undefined}
      sourceNoteId={sourceNoteId}
      target={target}
    />
  )
}

function ResourceNoteEmbedBlockView({
  block,
  blockProps,
  editor,
  editable,
  sourceNoteId,
  target,
}: NoteEmbedBlockViewProps & {
  blockProps: NoteEmbedBlockProps
  target: Extract<EmbedTarget, { kind: 'resource' }>
}) {
  const itemState = useResourceContentState(target.resourceId, 'Embedded item')

  return (
    <ResolvedNoteEmbedBlockView
      block={block}
      blockProps={blockProps}
      editor={editor}
      editable={editable}
      resolvedTargetItem={itemState.status === 'ready' ? itemState.item : null}
      resolvedSidebarItemState={itemState}
      sourceNoteId={sourceNoteId}
      target={target}
    />
  )
}

function ResolvedNoteEmbedBlockView({
  block,
  blockProps,
  editor,
  editable,
  resolvedTargetItem,
  resolvedSidebarItemState,
  sourceNoteId,
  target,
}: ResolvedNoteEmbedBlockViewProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const layout = useNoteEmbedBlockLayout({
    block,
    blockProps,
    editable,
    editor,
    resolvedTargetItem,
    target,
  })
  const surfaceDrag = useNoteEmbedSurfaceDrag(block)
  const selection = useNoteEmbedPointerSelection({
    block,
    editable,
    editor,
    rootRef,
    suppressSurfaceDragForPointer: surfaceDrag.suppressSurfaceDragForPointer,
  })
  const sidebarPreviewReady = useSidebarPreviewReadyForTarget(target)

  return (
    <NoteEmbedBlockFrame
      editable={editable}
      rootRef={rootRef}
      selection={selection}
      surfaceDrag={surfaceDrag}
      target={target}
      width={layout.width}
    >
      <ResolvedNoteEmbedVisualSurface
        editable={editable}
        embedBlockId={block.id}
        layout={layout}
        rootRef={rootRef}
        selection={selection}
        sidebarPreviewReady={sidebarPreviewReady}
        resolvedSidebarItemState={resolvedSidebarItemState}
        sourceNoteId={sourceNoteId}
        target={target}
      />
      <NoteEmbedSelectionControls
        block={block}
        editor={editor}
        editable={editable}
        layout={layout}
        rangeHighlighted={selection.rangeHighlighted}
        rootRef={rootRef}
        selected={selection.selected}
      />
    </NoteEmbedBlockFrame>
  )
}

function ResolvedNoteEmbedVisualSurface({
  editable,
  embedBlockId,
  layout,
  rootRef,
  selection,
  sidebarPreviewReady,
  resolvedSidebarItemState,
  sourceNoteId,
  target,
}: {
  editable: boolean
  embedBlockId: string
  layout: ReturnType<typeof useNoteEmbedBlockLayout>
  rootRef: RefObject<HTMLElement | null>
  selection: ReturnType<typeof useNoteEmbedPointerSelection>
  sidebarPreviewReady: boolean
  resolvedSidebarItemState: ResourceContentState | undefined
  sourceNoteId: SidebarItemId | null
  target: EmbedTarget
}) {
  return (
    <NoteEmbedVisualSurface
      editable={editable}
      embedBlockId={embedBlockId}
      selected={selection.selected}
      height={layout.height}
      mediaLayout={layout.effectiveMediaLayout}
      rootRef={rootRef}
      sidebarPreviewReady={sidebarPreviewReady}
      resolvedSidebarItemState={resolvedSidebarItemState}
      sourceNoteId={sourceNoteId}
      target={target}
      onMediaLayout={layout.handleMediaLayout}
      setTarget={layout.setTarget}
    />
  )
}

function NoteEmbedBlockFrame({
  children,
  editable,
  rootRef,
  selection,
  surfaceDrag,
  target,
  width,
}: NoteEmbedBlockFrameProps) {
  return (
    <section
      ref={rootRef}
      data-testid="note-embed-block"
      data-blocknote-external-drop-target={editable && target.kind === 'empty' ? 'true' : undefined}
      data-blocknote-external-drop-blocked={
        editable && target.kind !== 'empty' ? 'true' : undefined
      }
      data-note-embed-target-kind={target.kind}
      draggable={editable}
      className="note-embed-block allow-motion relative my-2 select-none overflow-visible"
      style={{ width, maxWidth: '100%' }}
      onPointerDownCapture={selection.handlePointerDownCapture}
      onMouseMoveCapture={selection.handleMouseMoveCapture}
      onPointerUpCapture={selection.handlePointerUpCapture}
      onPointerCancelCapture={selection.handlePointerCancelCapture}
      onDragStart={surfaceDrag.handleDragStart}
      onDragEnd={surfaceDrag.finishSurfaceDrag}
      onDropCapture={surfaceDrag.handleDropCapture}
    >
      {children}
    </section>
  )
}

function NoteEmbedSelectionControls({
  block,
  editor,
  editable,
  layout,
  rangeHighlighted,
  rootRef,
  selected,
}: {
  block: NoteEmbedBlockViewProps['block']
  editor: NoteEmbedBlockViewProps['editor']
  editable: boolean
  layout: ReturnType<typeof useNoteEmbedBlockLayout>
  rangeHighlighted: boolean
  rootRef: RefObject<HTMLElement | null>
  selected: boolean
}) {
  if (!selected && !rangeHighlighted) return null

  return (
    <NoteEmbedResizeWrapper
      mediaLayout={layout.effectiveMediaLayout}
      resizeEnabled={editable && selected}
      onResizeStart={(event, handle) => {
        startNoteEmbedResizeSession({
          ...getNoteEmbedResizeSessionState(layout),
          editorElement: editor.domElement,
          event,
          handle,
          root: rootRef.current,
          onCommit: ({ width: previewWidth, height: previewHeight }) => {
            editor.updateBlock(block, {
              props: stripUndefined({ previewWidth, previewHeight }),
            })
          },
        })
      }}
      onResizeKeyboard={(event, handle) => {
        const nextSize = getNoteEmbedKeyboardResize({
          ...getNoteEmbedResizeSessionState(layout),
          editorElement: editor.domElement,
          handle,
          key: event.key,
          root: rootRef.current,
        })
        if (!nextSize) return
        event.preventDefault()
        editor.updateBlock(block, {
          props: stripUndefined({
            previewWidth: nextSize.width,
            previewHeight: nextSize.height,
          }),
        })
      }}
    />
  )
}

function useNoteEmbedBlockLayout({
  block,
  blockProps,
  editable,
  editor,
  resolvedTargetItem,
  target,
}: {
  block: NoteEmbedBlockViewProps['block']
  blockProps: NoteEmbedBlockProps
  editable: boolean
  editor: NoteEmbedBlockViewProps['editor']
  resolvedTargetItem: AnyItemWithContent | null
  target: EmbedTarget
}) {
  const layoutSeedKey = getNoteEmbedLayoutSeedKey(blockProps)
  const [reportedMediaLayout, setReportedMediaLayout] =
    useState<ReportedNoteEmbedMediaLayout | null>(null)
  const mediaLayout =
    reportedMediaLayout?.seedKey === layoutSeedKey
      ? reportedMediaLayout.layout
      : getInitialNoteEmbedMediaLayout(blockProps)
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
  const width = getNoteEmbedPreviewWidth(blockProps, target)
  const height = getNoteEmbedPreviewHeight({
    blockProps,
    documentAspectRatio,
    maxHeightAspectRatio,
    usesFreeformHeight,
    width,
  })
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
  const setTarget = (nextTarget: EmbedTarget) => {
    editor.replaceBlocks(
      [block],
      [
        {
          ...block,
          props: getNextNoteEmbedBlockProps(blockProps, nextTarget),
        },
      ],
    )
  }

  return {
    effectiveMediaLayout,
    handleMediaLayout,
    height,
    maxHeightAspectRatio,
    setTarget,
    usesFreeformHeight,
    width,
  }
}

function useNoteEmbedSurfaceDrag(block: NoteEmbedBlockViewProps['block']) {
  const sideMenu = useExtension(SideMenuExtension)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const suppressionRef = useRef(false)
  const suppressionCleanupRef = useRef<(() => void) | null>(null)
  const registerDragCleanup = createNoteEmbedDragCleanupRegistrar({
    dragCleanupRef,
    sideMenu,
  })

  useEffect(
    () => () => {
      dragCleanupRef.current?.()
      suppressionCleanupRef.current?.()
    },
    [],
  )

  const finishSurfaceDrag = () => {
    finishNoteEmbedSurfaceDrag({ dragCleanupRef, sideMenu })
  }

  return {
    finishSurfaceDrag,
    handleDragStart: createNoteEmbedDragStartHandler({
      block,
      registerDragCleanup,
      sideMenu,
      suppressionRef,
    }),
    handleDropCapture: preventInternalNoteEmbedDrop,
    suppressSurfaceDragForPointer: (view: Window | null) => {
      suppressionCleanupRef.current?.()
      suppressionRef.current = true
      suppressionCleanupRef.current = registerPointerSuppressionCleanup(view, suppressionRef)
    },
  }
}

function finishNoteEmbedSurfaceDrag({
  dragCleanupRef,
  sideMenu,
}: {
  dragCleanupRef: MutableRefObject<(() => void) | null>
  sideMenu: NoteEmbedSideMenu
}) {
  const cleanup = dragCleanupRef.current
  if (cleanup) {
    cleanup()
    return
  }
  sideMenu.blockDragEnd()
  clearInternalNativeDrag()
}

function createNoteEmbedDragCleanupRegistrar({
  dragCleanupRef,
  sideMenu,
}: {
  dragCleanupRef: MutableRefObject<(() => void) | null>
  sideMenu: NoteEmbedSideMenu
}) {
  return (view: Window | null) => {
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
}

function createNoteEmbedDragStartHandler({
  block,
  registerDragCleanup,
  sideMenu,
  suppressionRef,
}: {
  block: NoteEmbedBlockViewProps['block']
  registerDragCleanup: (view: Window | null) => void
  sideMenu: NoteEmbedSideMenu
  suppressionRef: MutableRefObject<boolean>
}) {
  return (event: ReactDragEvent<HTMLElement>) => {
    if (event.defaultPrevented) return
    if (suppressionRef.current || isEmbedSurfaceDragExemptEventTarget(event.target)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    sideMenu.blockDragStart(event, block as never)
    markInternalNativeDrag(event.dataTransfer)
    registerDragCleanup(event.currentTarget.ownerDocument.defaultView)
  }
}

function preventInternalNoteEmbedDrop(event: ReactDragEvent<HTMLElement>) {
  if (isInternalNativeDrag(event.dataTransfer)) {
    event.preventDefault()
  }
}

function registerPointerSuppressionCleanup(
  view: Window | null,
  suppressionRef: { current: boolean },
) {
  if (!view) {
    suppressionRef.current = false
    return null
  }

  const cleanup = () => {
    view.removeEventListener('pointerup', cleanup, true)
    view.removeEventListener('pointercancel', cleanup, true)
    suppressionRef.current = false
  }

  view.addEventListener('pointerup', cleanup, true)
  view.addEventListener('pointercancel', cleanup, true)
  return cleanup
}

function isNoteEmbedResizeEventTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest('[data-note-embed-resize-zone="true"]')
}

function useNoteEmbedPointerSelection({
  block,
  editable,
  editor,
  rootRef,
  suppressSurfaceDragForPointer,
}: {
  block: NoteEmbedBlockViewProps['block']
  editable: boolean
  editor: NoteEmbedBlockViewProps['editor']
  rootRef: RefObject<HTMLElement | null>
  suppressSurfaceDragForPointer: (view: Window | null) => void
}) {
  const pointerStartedInsideRef = useRef(false)
  const [selected, setSelected] = useState(false)
  const [pointerRangeHighlighted, setPointerRangeHighlighted] = useState(false)
  const selectionRangeHighlighted = useEmbedBlockRangeHighlight(rootRef)

  useEffect(() => {
    if (!selected) return

    const clearSelectionOutsideEmbed = (event: PointerEvent) => {
      const eventTarget = event.target
      if (eventTarget instanceof Node && rootRef.current?.contains(eventTarget)) return
      setSelected(false)
    }

    window.addEventListener('pointerdown', clearSelectionOutsideEmbed, true)
    return () => window.removeEventListener('pointerdown', clearSelectionOutsideEmbed, true)
  }, [rootRef, selected])

  useEffect(() => {
    if (!pointerRangeHighlighted) return

    const finishPointerRangeSelection = (event: MouseEvent) => {
      const root = rootRef.current
      setPointerRangeHighlighted(false)
      if (!editable || !root) return

      const bounds = root.getBoundingClientRect()
      const endedOverEmbed =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      if (!endedOverEmbed) return

      root.ownerDocument.defaultView?.requestAnimationFrame(() => {
        editor.extendTextSelectionToBlockBoundary?.(block.id)
      })
    }
    const cancelPointerRangeSelection = () => setPointerRangeHighlighted(false)
    window.addEventListener('mouseup', finishPointerRangeSelection)
    window.addEventListener('pointercancel', cancelPointerRangeSelection)
    window.addEventListener('blur', cancelPointerRangeSelection)
    return () => {
      window.removeEventListener('mouseup', finishPointerRangeSelection)
      window.removeEventListener('pointercancel', cancelPointerRangeSelection)
      window.removeEventListener('blur', cancelPointerRangeSelection)
    }
  }, [block, editable, editor, pointerRangeHighlighted, rootRef])

  return {
    handlePointerCancelCapture: () => {
      pointerStartedInsideRef.current = false
      setPointerRangeHighlighted(false)
    },
    handlePointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
      pointerStartedInsideRef.current = true
      setPointerRangeHighlighted(false)
      if (!editable || event.button !== 0) return
      const eventTarget = event.target
      if (isNoteEmbedResizeEventTarget(eventTarget)) return
      if (isEmbedSurfaceDragExemptEventTarget(eventTarget)) {
        suppressSurfaceDragForPointer(event.currentTarget.ownerDocument.defaultView)
        return
      }
      setSelected(true)
      editor.setTextCursorPosition?.(block, 'start')
    },
    handleMouseMoveCapture: (event: ReactMouseEvent<HTMLElement>) => {
      if (
        !editable ||
        pointerStartedInsideRef.current ||
        (event.buttons & 1) === 0 ||
        isInternalNativeDrag(null)
      ) {
        return
      }
      if (isTextRangeSelectionAcrossEmbed(event.currentTarget)) {
        setPointerRangeHighlighted(true)
      }
    },
    handlePointerUpCapture: (event: ReactPointerEvent<HTMLElement>) => {
      const startedInside = pointerStartedInsideRef.current
      pointerStartedInsideRef.current = false
      if (startedInside || !editable || event.button !== 0) {
        setPointerRangeHighlighted(false)
      }
    },
    rangeHighlighted: selectionRangeHighlighted || pointerRangeHighlighted,
    selected,
  }
}

function useSidebarPreviewReady(
  targetKind: EmbedTarget['kind'],
  targetSidebarItemId: SidebarItemId | null,
) {
  const [readySidebarItemId, setReadySidebarItemId] = useState<SidebarItemId | null>(null)

  useEffect(() => {
    if (targetKind !== 'resource') return

    const frame = requestAnimationFrame(() => setReadySidebarItemId(targetSidebarItemId))
    return () => cancelAnimationFrame(frame)
  }, [targetKind, targetSidebarItemId])

  return targetKind !== 'resource' || readySidebarItemId === targetSidebarItemId
}

function useSidebarPreviewReadyForTarget(target: EmbedTarget) {
  const targetSidebarItemId = target.kind === 'resource' ? (target.resourceId ?? null) : null
  return useSidebarPreviewReady(target.kind, targetSidebarItemId)
}

function useEmbedBlockRangeHighlight(rootRef: RefObject<HTMLElement | null>) {
  const [rangeHighlighted, setRangeHighlighted] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const document = root.ownerDocument
    const updateRangeHighlight = () => {
      const nextRangeHighlighted = isEmbedBlockHighlightedBySelection(root)
      setRangeHighlighted((currentRangeHighlighted) =>
        currentRangeHighlighted === nextRangeHighlighted
          ? currentRangeHighlighted
          : nextRangeHighlighted,
      )
    }

    document.addEventListener('selectionchange', updateRangeHighlight)
    document.addEventListener('pointerup', updateRangeHighlight, true)
    document.addEventListener('keyup', updateRangeHighlight, true)
    return () => {
      document.removeEventListener('selectionchange', updateRangeHighlight)
      document.removeEventListener('pointerup', updateRangeHighlight, true)
      document.removeEventListener('keyup', updateRangeHighlight, true)
    }
  }, [rootRef])

  return rangeHighlighted
}

function isEmbedBlockHighlightedBySelection(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false

  if (
    selection.anchorNode &&
    selection.focusNode &&
    root.contains(selection.anchorNode) &&
    root.contains(selection.focusNode)
  ) {
    return false
  }

  const blockContent = root.closest<HTMLElement>('[data-content-type="embed"]')
  const blockBoundary = root.closest<HTMLElement>('[data-node-type="blockOuter"]') ?? blockContent
  if (!blockBoundary) return false

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    try {
      if (range.intersectsNode(blockBoundary)) return true
    } catch {
      return false
    }
  }

  return false
}

function isTextRangeSelectionAcrossEmbed(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection()
  const anchorNode = selection?.anchorNode
  const editorRoot = root.closest('.bn-editor')
  if (!selection || !anchorNode || !editorRoot?.contains(anchorNode) || root.contains(anchorNode)) {
    return false
  }

  const blockContent = root.closest<HTMLElement>('[data-content-type="embed"]')
  if (!blockContent) return false

  const relativePosition = anchorNode.compareDocumentPosition(blockContent)
  const anchorComesBeforeEmbed = Boolean(relativePosition & Node.DOCUMENT_POSITION_FOLLOWING)
  const anchorComesAfterEmbed = Boolean(relativePosition & Node.DOCUMENT_POSITION_PRECEDING)
  return anchorComesBeforeEmbed || anchorComesAfterEmbed
}

function NoteEmbedVisualSurface({
  editable,
  embedBlockId,
  height,
  mediaLayout,
  onMediaLayout,
  rootRef,
  selected,
  setTarget,
  sidebarPreviewReady,
  resolvedSidebarItemState,
  sourceNoteId,
  target,
}: NoteEmbedVisualSurfaceProps) {
  const contextMenu = use(BlockNoteContextMenuContext)
  const contextMenuItem =
    resolvedSidebarItemState?.status === 'ready' ? resolvedSidebarItemState.item : null
  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!contextMenuItem) return

    event.preventDefault()
    event.stopPropagation()
    contextMenu?.openMenu({
      position: { x: event.clientX, y: event.clientY },
      surface: 'note-view',
      item: contextMenuItem,
    })
  }

  return (
    <div
      data-testid="note-embed-visual-surface"
      contentEditable={false}
      draggable={false}
      onContextMenu={handleContextMenu}
      className={cn(
        'w-full select-none overflow-hidden border border-border bg-card text-card-foreground',
        target.kind === 'empty' && 'border-dashed bg-muted/20',
      )}
    >
      {target.kind !== 'empty' ? <NoteEmbedBlockHeader target={target} /> : null}
      {editable ? (
        <EditableNoteEmbedBlockBody
          allowInnerScroll={selected}
          embedBlockId={embedBlockId}
          height={height}
          mediaLayout={mediaLayout}
          rootRef={rootRef}
          sidebarPreviewReady={sidebarPreviewReady}
          resolvedSidebarItemState={resolvedSidebarItemState}
          sourceNoteId={sourceNoteId}
          target={target}
          onMediaLayout={onMediaLayout}
          setTarget={setTarget}
        />
      ) : (
        <ReadOnlyNoteEmbedBlockBody
          allowInnerScroll={selected}
          height={height}
          mediaLayout={mediaLayout}
          sidebarPreviewReady={sidebarPreviewReady}
          resolvedSidebarItemState={resolvedSidebarItemState}
          sourceNoteId={sourceNoteId}
          target={target}
          onMediaLayout={onMediaLayout}
        />
      )}
    </div>
  )
}

function ReadOnlyNoteEmbedBlockBody({
  allowInnerScroll,
  height,
  mediaLayout,
  onMediaLayout,
  resolvedSidebarItemState,
  sidebarPreviewReady,
  sourceNoteId,
  target,
}: NoteEmbedBlockBodyContentProps) {
  const { renderEmbeddedNotePreview } = useNoteEmbedSurface()

  return (
    <div
      data-note-embed-body="true"
      className={getNoteEmbedBodyClassName(mediaLayout)}
      style={getNoteEmbedBodyStyle(mediaLayout, height)}
    >
      {sidebarPreviewReady ? (
        <EmbedContent
          target={target}
          sourceItemId={sourceNoteId}
          mode="readonly"
          allowInnerScroll={allowInnerScroll}
          onMediaLayout={onMediaLayout}
          renderEmbeddedNotePreview={renderEmbeddedNotePreview}
          resolvedResourceContentState={resolvedSidebarItemState}
        />
      ) : (
        <EmbedLoadingState />
      )}
    </div>
  )
}

function EditableNoteEmbedBlockBody({
  allowInnerScroll,
  embedBlockId,
  height,
  mediaLayout,
  rootRef,
  sidebarPreviewReady,
  resolvedSidebarItemState,
  sourceNoteId,
  target,
  onMediaLayout,
  setTarget,
}: EditableNoteEmbedBlockBodyProps) {
  const { embedTargetOperations, renderEmbeddedNotePreview } = useNoteEmbedSurface()
  const uploadFile = embedTargetOperations?.uploadFile
  const pendingUpload = usePendingEmbedUpload('note', embedBlockId)
  const embedControls = useEditableEmbedTargetControls({
    setTarget,
    uploadFile,
    uploadSurface: 'note',
    embedId: embedBlockId,
  })

  const dropVisualState = useEmbedDropTarget({
    embedBlockId,
    ref: rootRef,
    enabled: pendingUpload === null,
    sourceItemId: sourceNoteId,
    setTarget: embedControls.setTargetAndCloseDraft,
    targetKind: target.kind,
    uploadFile: embedControls.uploadFile,
    uploadSurface: 'note',
  })

  return (
    <>
      <EditableNoteEmbedBodyContent
        allowInnerScroll={allowInnerScroll}
        dropVisualState={target.kind === 'empty' ? dropVisualState : undefined}
        embedControls={embedControls}
        height={height}
        loadingLabel={pendingUpload ? `Uploading ${pendingUpload.fileName}` : undefined}
        mediaLayout={mediaLayout}
        onMediaLayout={onMediaLayout}
        renderEmbeddedNotePreview={renderEmbeddedNotePreview}
        resolvedSidebarItemState={resolvedSidebarItemState}
        sidebarPreviewReady={sidebarPreviewReady}
        sourceNoteId={sourceNoteId}
        target={target}
        uploadEnabled={Boolean(uploadFile)}
      />
      <input
        ref={embedControls.fileInputRef}
        type="file"
        aria-label="Embed file upload"
        className="hidden"
        onChange={embedControls.handleFileInputChange}
      />
      <EditableEmbedUploadStatus
        controls={embedControls}
        className="border-t border-border px-3 py-2 text-sm"
      />
      <EditableEmbedLinkDraftForm
        controls={embedControls}
        className="flex gap-2 border-t border-border p-2"
        errorClassName="self-center text-sm text-destructive"
      />
    </>
  )
}

function EditableNoteEmbedBodyContent({
  allowInnerScroll,
  dropVisualState,
  embedControls,
  height,
  loadingLabel,
  mediaLayout,
  onMediaLayout,
  renderEmbeddedNotePreview,
  resolvedSidebarItemState,
  sidebarPreviewReady,
  sourceNoteId,
  target,
  uploadEnabled,
}: NoteEmbedBlockBodyContentProps & {
  dropVisualState: ReturnType<typeof useEmbedDropTarget> | undefined
  embedControls: EditableNoteEmbedControls
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  loadingLabel?: string
  uploadEnabled: boolean
}) {
  return (
    <div
      data-note-embed-body="true"
      className={getNoteEmbedBodyClassName(mediaLayout)}
      style={getNoteEmbedBodyStyle(mediaLayout, height)}
    >
      {sidebarPreviewReady ? (
        <EmbedContent
          target={target}
          sourceItemId={sourceNoteId}
          mode="editable"
          loadingLabel={loadingLabel}
          onUpload={uploadEnabled ? embedControls.openFilePicker : undefined}
          onLinkExternal={embedControls.openLinkDraft}
          allowInnerScroll={allowInnerScroll}
          onMediaLayout={onMediaLayout}
          dropVisualState={dropVisualState}
          renderEmbeddedNotePreview={renderEmbeddedNotePreview}
          resolvedResourceContentState={resolvedSidebarItemState}
        />
      ) : (
        <EmbedLoadingState />
      )}
    </div>
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
  onResizeKeyboard,
  resizeEnabled,
}: {
  mediaLayout: EmbedMediaLayout | null
  onResizeStart: (event: ReactPointerEvent<HTMLElement>, handle: ResizeHandlePosition) => void
  onResizeKeyboard: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handle: ResizeHandlePosition,
  ) => void
  resizeEnabled: boolean
}) {
  return (
    <div
      data-testid="note-embed-resize-wrapper"
      contentEditable={false}
      draggable={false}
      className="note-embed-resize-wrapper pointer-events-none absolute left-0 top-0 z-30 h-full w-full"
    >
      <NoteEmbedSelectionChrome />
      {resizeEnabled ? (
        <NoteEmbedResizeHandles
          mediaLayout={mediaLayout}
          onResizeKeyboard={onResizeKeyboard}
          onResizeStart={onResizeStart}
        />
      ) : null}
    </div>
  )
}

function NoteEmbedSelectionChrome() {
  return (
    <>
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
    </>
  )
}

function NoteEmbedResizeHandles({
  mediaLayout,
  onResizeKeyboard,
  onResizeStart,
}: {
  mediaLayout: EmbedMediaLayout | null
  onResizeKeyboard: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handle: ResizeHandlePosition,
  ) => void
  onResizeStart: (event: ReactPointerEvent<HTMLElement>, handle: ResizeHandlePosition) => void
}) {
  return (
    <>
      {getNoteEmbedResizeHandleDescriptors(mediaLayout).map(({ position, cursorClassName }) => (
        <button
          key={position}
          type="button"
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
          onKeyDown={(event) => onResizeKeyboard(event, position)}
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
  position: ResizeHandlePosition,
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

function getNextNoteEmbedBlockProps(
  currentProps: NoteEmbedBlockProps,
  nextTarget: EmbedTarget,
): NoteEmbedBlockProps {
  return {
    ...getSharedEmbedBlockProps(currentProps),
    ...(nextTarget.kind !== 'empty' && !getPositiveFiniteNumber(currentProps.previewWidth)
      ? { previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH }
      : {}),
    ...blockPropsFromEmbedTarget(nextTarget),
  }
}

function getNoteEmbedPreviewWidth(blockProps: NoteEmbedBlockProps, target: EmbedTarget) {
  return (
    getPositiveFiniteNumber(blockProps.previewWidth) ??
    (target.kind !== 'empty' ? DEFAULT_NOTE_EMBED_PREVIEW_WIDTH : undefined)
  )
}

function getNoteEmbedPreviewHeight({
  blockProps,
  documentAspectRatio,
  maxHeightAspectRatio,
  usesFreeformHeight,
  width,
}: {
  blockProps: NoteEmbedBlockProps
  documentAspectRatio: number | null
  maxHeightAspectRatio: number | null
  usesFreeformHeight: boolean
  width: number | undefined
}) {
  return clampNoteEmbedPreviewHeight(
    (usesFreeformHeight ? getPositiveFiniteNumber(blockProps.previewHeight) : undefined) ??
      getDefaultNoteEmbedPreviewHeight({
        aspectRatio: documentAspectRatio,
        usesFreeformHeight,
        width,
      }),
    { maxHeightAspectRatio, width },
  )
}

function getNoteEmbedResizeSessionState(layout: ReturnType<typeof useNoteEmbedBlockLayout>) {
  return {
    aspectRatio: getNoteEmbedAspectRatio(layout.effectiveMediaLayout),
    height: layout.height,
    maxHeightAspectRatio: layout.maxHeightAspectRatio,
    resizeHeight: layout.usesFreeformHeight,
    useMeasuredAspectRatioFallback: !layout.usesFreeformHeight,
    width: layout.width,
  }
}

function getInitialNoteEmbedMediaLayout(props: NoteEmbedBlockProps): EmbedMediaLayout | null {
  const aspectRatio =
    getPositiveFiniteNumber(props.previewAspectRatio) ??
    getDocumentEmbedAspectRatioForTarget(embedTargetFromBlockProps(props))
  return aspectRatio ? { kind: 'intrinsicAspectRatio', aspectRatio } : null
}

function getDocumentEmbedMediaLayout(aspectRatio: number | null): EmbedMediaLayout | null {
  return aspectRatio ? { kind: 'intrinsicAspectRatio', aspectRatio } : null
}

function getNoteEmbedLayoutSeedKey(props: NoteEmbedBlockProps) {
  return [
    props.targetKind ?? 'empty',
    props.resourceId ?? '',
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
  position: ResizeHandlePosition,
  mediaLayout: EmbedMediaLayout | null,
) {
  if (mediaLayout?.kind !== 'fixedHeight') {
    return true
  }

  return position === 'left' || position === 'right'
}

function getNoteEmbedResizeZoneClassName(handle: ResizeHandlePosition) {
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

function isEmbedScrollControlEventTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('[data-slot="scroll-area-scrollbar"], [data-slot="scroll-area-thumb"]')
  )
}

function isEmbedSurfaceDragExemptEventTarget(target: EventTarget | null) {
  return isEmbedMediaControlEventTarget(target) || isEmbedScrollControlEventTarget(target)
}

function doesTargetUseFreeformNoteEmbedHeight(
  resolvedTargetItem: { type?: unknown } | null | undefined,
) {
  return (
    resolvedTargetItem?.type === RESOURCE_TYPES.notes ||
    resolvedTargetItem?.type === RESOURCE_TYPES.canvases
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
  return resolvedTargetItem?.type === RESOURCE_TYPES.canvases ? documentAspectRatio : null
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
