import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import type { EmbedTarget } from '../../../../../../shared/embeds/embedTargets'
import { normalizeEmbedNodeData } from '../../embed-node-model'
import {
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasViewportRuntime,
} from '../../runtime/providers/canvas-runtime'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import { CANVAS_NODE_MIN_SIZE } from '../shared/canvas-node-resize-constants'
import type { EmbedNodeData } from '../../embed-node-model'
import { CanvasFloatingFormattingToolbar } from '../shared/canvas-floating-formatting-toolbar'
import { registerCanvasTextFormattingSession } from '../../text/formatting-session'
import { useCanvasEditableNodeSession } from '../shared/use-canvas-editable-node-session'
import type { AnyItemWithContent } from '../../../workspace/items'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import type { CustomBlockNoteEditor } from '../../../notes/editor-schema'
import {
  getCanvasNodeDefaultTextColor,
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../../node-surface-style'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasEngine } from '../../react/canvas-engine-context-value'
import { useCanvasViewportZoom } from '../../react/use-canvas-engine'
import type { CanvasNodeComponentProps } from '../canvas-node-types'
import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import {
  EMBED_NODE_MIN_SIZE,
  resolveDefaultEmbedNodeResizeForLockedAspectRatio,
} from '../../embed-node-size'
import { EmbedContent } from '../../../embeds/components/embed-content'
import {
  EditableEmbedLinkDraftForm,
  EditableEmbedUploadStatus,
} from '../../../embeds/components/editable-target-controls'
import { CanvasResourceEmbedSurface } from '../../../embeds/components/canvas-resource-embed-surface'
import type { ResourceEmbedSurfaceRenderer } from '../../../embeds/components/embed-content'
import type { ResourceContentState } from '../../../filesystem/resource-content-source'
import { useResourceContentState } from '../../../filesystem/resource-content-context'
import { useEmbedDropTarget } from '../../../embeds/hooks/use-drop-target'
import { useEditableEmbedTargetControls } from '../../../embeds/hooks/use-editable-target-controls'
import { usePendingEmbedUpload } from '../../../embeds/pending-upload'
import type { EmbedMediaLayout } from '../../../embeds/utils/media'
import { areEmbedMediaLayoutsEqual, getEmbedMediaAspectRatio } from '../../../embeds/utils/media'
import type { PendingRichEmbedActivationRef } from '../../../rich-text/deferred-activation'
import { getDefaultDocumentEmbedAspectRatio } from '../../../embeds/utils/document-layout'
import {
  isCanvasSidebarItemEmbedRichTextEditable,
  shouldCanvasSidebarItemEmbedLockToMediaAspectRatio,
  shouldCanvasSidebarItemEmbedUseDocumentShapeDefault,
  shouldCanvasSidebarItemEmbedUseFreeformResize,
  shouldClearDefaultCanvasSidebarItemEmbedAspectRatio,
} from '../../../embeds/utils/canvas-resource-capabilities'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { CanvasNoteContentSources } from '../../note-content-sources'

const EMBED_FLOATING_LABEL_GAP_PX = 6
const EMBED_FLOATING_LABEL_LINE_HEIGHT_PX = 16

function persistEmbedTextColor(
  patchNodeData: CanvasDocumentWriter['patchNodeData'],
  id: string,
  textColor: string,
) {
  patchNodeData(new Map([[id, { textColor }]]))
}

function useEmbedNodeMediaLayout({
  canvasEngine,
  contentItem,
  documentAspectRatio,
  documentWriter,
  id,
  lockedAspectRatio,
  patchNodeData,
  target,
}: {
  canvasEngine: ReturnType<typeof useCanvasEngine>
  contentItem: AnyItemWithContent | undefined
  documentAspectRatio: number | null
  documentWriter: CanvasDocumentWriter
  id: string
  lockedAspectRatio: number | null
  patchNodeData: CanvasDocumentWriter['patchNodeData']
  target: EmbedTarget
}) {
  const mediaLayoutIdentity = getEmbedMediaLayoutIdentity(target, contentItem)
  const [reportedMediaLayout, setReportedMediaLayout] = useState<{
    layout: EmbedMediaLayout
    mediaLayoutIdentity: string
  } | null>(null)
  const mediaLayout =
    reportedMediaLayout?.mediaLayoutIdentity === mediaLayoutIdentity
      ? reportedMediaLayout.layout
      : null
  const mediaLayoutRef = useRef<{
    layout: EmbedMediaLayout
    mediaLayoutIdentity: string
  } | null>(null)
  if (mediaLayoutRef.current?.mediaLayoutIdentity !== mediaLayoutIdentity) {
    mediaLayoutRef.current = null
  }
  const lastStoredAspectRatioRef = useRef<number | null>(lockedAspectRatio)

  const resizeDefaultNodeForAspectRatio = (aspectRatio: number) => {
    const node = canvasEngine.getSnapshot().nodeLookup.get(id)?.node
    const resize = node
      ? resolveDefaultEmbedNodeResizeForLockedAspectRatio(node, aspectRatio)
      : null
    if (resize) {
      documentWriter.resizeNode(id, resize.width, resize.height, resize.position)
    }
  }

  const resetMediaLayout = () => {
    mediaLayoutRef.current = null
    setReportedMediaLayout(null)
    lastStoredAspectRatioRef.current = null
  }

  const setEmbedMediaLayout = (layout: EmbedMediaLayout) => {
    const currentMediaLayout = mediaLayoutRef.current
    if (
      currentMediaLayout?.mediaLayoutIdentity === mediaLayoutIdentity &&
      areEmbedMediaLayoutsEqual(currentMediaLayout.layout, layout)
    ) {
      return
    }

    mediaLayoutRef.current = { layout, mediaLayoutIdentity }
    setReportedMediaLayout({ layout, mediaLayoutIdentity })
    const nextLockedAspectRatio = getEmbedMediaAspectRatio(layout)
    patchStoredEmbedAspectRatio({
      id,
      lastStoredAspectRatioRef,
      lockedAspectRatio: nextLockedAspectRatio,
      patchNodeData,
    })
    if (nextLockedAspectRatio) {
      resizeDefaultNodeForAspectRatio(nextLockedAspectRatio)
    }

    if (layout.kind === 'fixedHeight') {
      const node = canvasEngine.getSnapshot().nodeLookup.get(id)?.node
      if (node && node.height !== layout.height) {
        documentWriter.resizeNode(
          id,
          node.width ?? CANVAS_NODE_MIN_SIZE,
          layout.height,
          node.position,
        )
      }
    }
  }

  useEffect(() => {
    if (mediaLayout !== null) return
    syncDefaultEmbedNodeLayout({
      canvasEngine,
      contentItem,
      documentAspectRatio,
      documentWriter,
      id,
      lastStoredAspectRatioRef,
      patchNodeData,
    })
  }, [
    canvasEngine,
    contentItem,
    documentAspectRatio,
    documentWriter,
    id,
    mediaLayout,
    patchNodeData,
  ])

  return { mediaLayout, resetMediaLayout, setEmbedMediaLayout }
}

function syncDefaultEmbedNodeLayout({
  canvasEngine,
  contentItem,
  documentAspectRatio,
  documentWriter,
  id,
  lastStoredAspectRatioRef,
  patchNodeData,
}: {
  canvasEngine: ReturnType<typeof useCanvasEngine>
  contentItem: AnyItemWithContent | undefined
  documentAspectRatio: number | null
  documentWriter: CanvasDocumentWriter
  id: string
  lastStoredAspectRatioRef: MutableRefObject<number | null>
  patchNodeData: CanvasDocumentWriter['patchNodeData']
}) {
  if (shouldClearDefaultCanvasSidebarItemEmbedAspectRatio(contentItem)) {
    patchStoredEmbedAspectRatio({
      id,
      lastStoredAspectRatioRef,
      lockedAspectRatio: null,
      patchNodeData,
    })
    if (!shouldCanvasSidebarItemEmbedUseDocumentShapeDefault(contentItem)) return
  }

  if (!documentAspectRatio) return

  if (!shouldClearDefaultCanvasSidebarItemEmbedAspectRatio(contentItem)) {
    patchStoredEmbedAspectRatio({
      id,
      lastStoredAspectRatioRef,
      lockedAspectRatio: documentAspectRatio,
      patchNodeData,
    })
  }

  const node = canvasEngine.getSnapshot().nodeLookup.get(id)?.node
  const resize = node
    ? resolveDefaultEmbedNodeResizeForLockedAspectRatio(node, documentAspectRatio)
    : null
  if (resize) {
    documentWriter.resizeNode(id, resize.width, resize.height, resize.position)
  }
}

function patchStoredEmbedAspectRatio({
  id,
  lastStoredAspectRatioRef,
  lockedAspectRatio,
  patchNodeData,
}: {
  id: string
  lastStoredAspectRatioRef: MutableRefObject<number | null>
  lockedAspectRatio: number | null
  patchNodeData: CanvasDocumentWriter['patchNodeData']
}) {
  if (lastStoredAspectRatioRef.current === lockedAspectRatio) return

  lastStoredAspectRatioRef.current = lockedAspectRatio
  patchNodeData(new Map([[id, { lockedAspectRatio }]]))
}

export function EmbedNode({ id, data, dragging }: CanvasNodeComponentProps<'embed'>) {
  const normalizedData = normalizeEmbedNodeData(data)
  const target = normalizedData.target

  if (target.kind === 'resource') {
    return (
      <ResourceEmbedNode
        id={id}
        normalizedData={normalizedData}
        dragging={dragging}
        target={target}
      />
    )
  }

  return (
    <ResolvedEmbedNode
      id={id}
      normalizedData={normalizedData}
      dragging={dragging}
      itemState={undefined}
    />
  )
}

function ResourceEmbedNode({
  dragging,
  id,
  normalizedData,
  target,
}: {
  id: string
  normalizedData: EmbedNodeData
  dragging?: boolean
  target: Extract<EmbedTarget, { kind: 'resource' }>
}) {
  const itemState = useResourceContentState(target.resourceId, 'Embedded item')

  return (
    <ResolvedEmbedNode
      id={id}
      normalizedData={normalizedData}
      dragging={dragging}
      itemState={itemState}
    />
  )
}

function ResolvedEmbedNode({
  dragging,
  id,
  itemState,
  normalizedData,
}: {
  id: string
  normalizedData: EmbedNodeData
  dragging?: boolean
  itemState: ResourceContentState | undefined
}) {
  const target = normalizedData.target
  const resolvedItem = getResolvedResourceContentState({ target, itemState })
  const editingRuntime = useEmbedNodeEditingRuntime({
    id,
    contentItem: resolvedItem.contentItem,
    normalizedData,
  })
  const documentRuntime = useEmbedNodeDocumentRuntime({
    id,
    target,
    contentItem: resolvedItem.contentItem,
    normalizedData,
  })

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="embed"
      dragging={!!dragging}
      minWidth={EMBED_NODE_MIN_SIZE.width}
      minHeight={getEmbedResizeMinHeight(documentRuntime.mediaLayout)}
      lockedAspectRatio={getLockedAspectRatio({
        target,
        contentItem: resolvedItem.contentItem,
        mediaLayout: documentRuntime.mediaLayout,
        normalizedData,
        documentAspectRatio: documentRuntime.documentAspectRatio,
      })}
      resizeAxes={documentRuntime.mediaLayout?.kind === 'fixedHeight' ? 'horizontal' : 'both'}
      editing={editingRuntime.showsFormattingToolbar}
      chrome={
        <EmbedNodeChrome
          defaultTextColor={editingRuntime.defaultTextColor}
          id={id}
          isUnavailable={resolvedItem.isUnavailable}
          label={resolvedItem.label}
          noteEditor={editingRuntime.noteEditor}
          patchNodeData={documentRuntime.patchNodeData}
          showFloatingLabel={!editingRuntime.showsFormattingToolbar}
          showsFormattingToolbar={editingRuntime.showsFormattingToolbar}
          zoom={editingRuntime.zoom}
        />
      }
    >
      <EmbedNodeSurface
        allowInnerScroll={editingRuntime.allowInnerScroll}
        canvasId={documentRuntime.canvasId}
        contentItem={resolvedItem.contentItem}
        editableSession={editingRuntime.editableSession}
        interactiveRenderMode={editingRuntime.interactiveRenderMode}
        isEditableEmbed={editingRuntime.isEditableEmbed}
        isEditing={editingRuntime.isEditing}
        itemState={itemState}
        nodeId={id}
        normalizedData={normalizedData}
        richContentRuntime={editingRuntime.richContentContext}
        setEmbedMediaLayout={documentRuntime.setEmbedMediaLayout}
        setTarget={documentRuntime.setTarget}
        surfaceRef={editingRuntime.surfaceRef}
        target={target}
      />
    </ResizableNodeWrapper>
  )
}

function getResolvedResourceContentState({
  itemState,
  target,
}: {
  itemState: ResourceContentState | undefined
  target: EmbedTarget
}) {
  const contentItem = itemState?.status === 'ready' ? itemState.item : undefined
  const label = getEmbedFloatingLabel(target, itemState?.label ?? 'Embedded item')
  const isUnavailable =
    target.kind === 'resource' &&
    itemState?.status !== 'ready' &&
    itemState?.status !== 'loading' &&
    itemState?.status !== 'idle'

  return { contentItem, isUnavailable, label }
}

function useEmbedNodeEditingRuntime({
  contentItem,
  id,
  normalizedData,
}: {
  contentItem: AnyItemWithContent | undefined
  id: string
  normalizedData: EmbedNodeData
}) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const { domRuntime } = useCanvasViewportRuntime()
  const { canEdit, editSession } = useCanvasInteractionRuntime()
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit: canEdit && interactiveRenderMode,
    editing: editSession.editingEmbedId === id,
    setEditing: (editing) => editSession.setEditingEmbedId(editing ? id : null),
  })
  const supportsRichTextEditing = isCanvasSidebarItemEmbedRichTextEditable(contentItem)
  const isEditing = editableSession.editable && supportsRichTextEditing
  const noteEditor = supportsRichTextEditing ? editor : null
  const showsFormattingToolbar = isEditing && noteEditor !== null
  const defaultTextColor = getCanvasNodeDefaultTextColor(normalizedData)
  const zoom = useCanvasViewportZoom()
  const isEditableEmbed = canEdit && interactiveRenderMode
  const allowInnerScroll = interactiveRenderMode && editableSession.isExclusivelySelected

  useEffect(() => domRuntime.registerNodeSurfaceElement(id, surfaceRef.current), [domRuntime, id])

  const {
    documentWriter,
    noteDocumentSource,
    noteEmbeddedNoteContentSource,
    noteEmbedTargetSource,
    noteLinkCreationSource,
    noteLinkNavigationSource,
    noteLinkResolutionSource,
    notePlaybackSource,
    notePermissionSource,
    noteSharingSource,
    noteValueReferences,
    noteValueStateSource,
    noteWikiLinkSource,
  } = useCanvasDocumentRuntime()
  const { patchNodeData } = documentWriter

  useEffect(() => {
    if (!showsFormattingToolbar || !noteEditor) {
      return
    }

    return registerCanvasTextFormattingSession({
      nodeId: id,
      editor: noteEditor,
      defaultTextColor,
      setDefaultTextColor: (textColor) => {
        persistEmbedTextColor(patchNodeData, id, textColor)
      },
    })
  }, [defaultTextColor, id, noteEditor, patchNodeData, showsFormattingToolbar])

  return {
    allowInnerScroll,
    defaultTextColor,
    editableSession,
    interactiveRenderMode,
    isEditableEmbed,
    isEditing,
    noteEditor,
    richContentContext: {
      isEditing,
      isExclusivelySelected: editableSession.isExclusivelySelected,
      interactiveRenderMode,
      noteDocumentSource,
      noteEmbeddedNoteContentSource,
      noteEmbedTargetSource,
      noteLinkCreationSource,
      noteLinkNavigationSource,
      noteLinkResolutionSource,
      notePlaybackSource,
      notePermissionSource,
      noteSharingSource,
      noteValueReferences,
      noteValueStateSource,
      noteWikiLinkSource,
      onActivated: editableSession.handleActivated,
      onEditorChange: setEditor,
      pendingActivationRef: editableSession.pendingActivationRef,
      textColor: normalizedData.textColor,
    },
    showsFormattingToolbar,
    surfaceRef,
    zoom,
  }
}

function useEmbedNodeDocumentRuntime({
  contentItem,
  id,
  normalizedData,
  target,
}: {
  contentItem: AnyItemWithContent | undefined
  id: string
  normalizedData: EmbedNodeData
  target: EmbedTarget
}) {
  const canvasEngine = useCanvasEngine()
  const { canvasId, documentWriter, provider } = useCanvasDocumentRuntime()
  const { patchNodeData } = documentWriter
  const documentAspectRatio = getDefaultDocumentEmbedAspectRatio({
    target,
    item: contentItem,
  })
  const { mediaLayout, resetMediaLayout, setEmbedMediaLayout } = useEmbedNodeMediaLayout({
    canvasEngine,
    contentItem,
    documentAspectRatio,
    documentWriter,
    id,
    lockedAspectRatio: normalizedData.lockedAspectRatio ?? null,
    patchNodeData,
    target,
  })
  const setTarget = async (nextTarget: EmbedTarget) => {
    resetMediaLayout()
    patchNodeData(new Map([[id, { target: nextTarget, lockedAspectRatio: null }]]))
    await provider?.flushUpdates()
  }

  return {
    canvasId,
    documentAspectRatio,
    mediaLayout,
    patchNodeData,
    setEmbedMediaLayout,
    setTarget,
  }
}

function EmbedNodeChrome({
  defaultTextColor,
  id,
  isUnavailable,
  label,
  noteEditor,
  patchNodeData,
  showFloatingLabel,
  showsFormattingToolbar,
  zoom,
}: {
  defaultTextColor: string
  id: string
  isUnavailable: boolean
  label: string
  noteEditor: CustomBlockNoteEditor | null
  patchNodeData: CanvasDocumentWriter['patchNodeData']
  showFloatingLabel: boolean
  showsFormattingToolbar: boolean
  zoom: number
}) {
  return (
    <>
      <CanvasFloatingFormattingToolbar
        defaultTextColor={defaultTextColor}
        editor={noteEditor}
        onDefaultTextColorChange={(textColor) => {
          persistEmbedTextColor(patchNodeData, id, textColor)
        }}
        visible={showsFormattingToolbar}
      />
      <CanvasNodeConnectionHandles />
      {showFloatingLabel && (
        <EmbedFloatingLabel label={label} missing={isUnavailable} zoom={zoom} />
      )}
    </>
  )
}

function EmbedNodeSurface({
  allowInnerScroll,
  canvasId,
  contentItem,
  editableSession,
  interactiveRenderMode,
  isEditableEmbed,
  isEditing,
  itemState,
  nodeId,
  normalizedData,
  richContentRuntime,
  setEmbedMediaLayout,
  setTarget,
  surfaceRef,
  target,
}: {
  allowInnerScroll: boolean
  canvasId: SidebarItemId | null
  contentItem: AnyItemWithContent | undefined
  editableSession: ReturnType<typeof useCanvasEditableNodeSession>
  interactiveRenderMode: boolean
  isEditableEmbed: boolean
  isEditing: boolean
  itemState: ResourceContentState | undefined
  nodeId: string
  normalizedData: EmbedNodeData
  richContentRuntime: CanvasSidebarItemEmbedRuntime
  setEmbedMediaLayout: (layout: EmbedMediaLayout) => void
  setTarget: (target: EmbedTarget) => Promise<void>
  surfaceRef: RefObject<HTMLDivElement | null>
  target: EmbedTarget
}) {
  return (
    <div
      ref={surfaceRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg',
        isEditing ? 'select-text' : 'select-none',
      )}
      style={{
        ...getCanvasNodeSurfaceStyle(normalizedData),
        ...getCanvasNodeTextStyle(normalizedData),
      }}
      onDoubleClick={(event) => {
        if (!interactiveRenderMode || !isCanvasSidebarItemEmbedRichTextEditable(contentItem)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        editableSession.handleDoubleClick(event)
      }}
    >
      <div className="h-full w-full min-h-0 min-w-0">
        {isEditableEmbed ? (
          <EditableCanvasEmbedContent
            rootRef={surfaceRef}
            embedBlockId={nodeId}
            sourceCanvasId={canvasId}
            target={target}
            setTarget={setTarget}
            onMediaLayout={setEmbedMediaLayout}
            allowInnerScroll={allowInnerScroll}
            richContentRuntime={richContentRuntime}
            resolvedResourceContentState={itemState}
          />
        ) : (
          <CanvasEmbedContent
            target={target}
            sourceCanvasId={canvasId}
            mode="readonly"
            onMediaLayout={setEmbedMediaLayout}
            allowInnerScroll={allowInnerScroll}
            richContentRuntime={richContentRuntime}
            resolvedResourceContentState={itemState}
          />
        )}
      </div>
    </div>
  )
}

function EditableCanvasEmbedContent({
  embedBlockId,
  rootRef,
  sourceCanvasId,
  target,
  setTarget,
  onMediaLayout,
  allowInnerScroll,
  richContentRuntime,
  resolvedResourceContentState,
}: {
  embedBlockId: string
  rootRef: RefObject<HTMLElement | null>
  sourceCanvasId: SidebarItemId | null
  target: EmbedTarget
  setTarget: (target: EmbedTarget) => Promise<void>
  onMediaLayout: (layout: EmbedMediaLayout) => void
  allowInnerScroll: boolean
  richContentRuntime: CanvasSidebarItemEmbedRuntime
  resolvedResourceContentState?: ResourceContentState
}) {
  const { embedTargetOperations } = useCanvasDocumentRuntime()
  const uploadFile = embedTargetOperations?.uploadFile
  const pendingUpload = usePendingEmbedUpload('canvas', embedBlockId)
  const embedControls = useEditableEmbedTargetControls({
    setTarget,
    uploadFile,
    uploadSurface: 'canvas',
    embedId: embedBlockId,
  })

  const dropVisualState = useEmbedDropTarget({
    embedBlockId,
    ref: rootRef,
    enabled: pendingUpload === null,
    sourceItemId: sourceCanvasId,
    setTarget: embedControls.setTargetAndCloseDraft,
    targetKind: target.kind,
    uploadFile: embedControls.uploadFile,
    uploadSurface: 'canvas',
  })

  return (
    <>
      <CanvasEmbedContent
        target={target}
        loadingLabel={pendingUpload ? `Uploading ${pendingUpload.fileName}` : undefined}
        sourceCanvasId={sourceCanvasId}
        mode="editable"
        onUpload={uploadFile ? embedControls.openFilePicker : undefined}
        onLinkExternal={embedControls.openLinkDraft}
        onMediaLayout={onMediaLayout}
        allowInnerScroll={allowInnerScroll}
        dropVisualState={target.kind === 'empty' ? dropVisualState : undefined}
        richContentRuntime={richContentRuntime}
        resolvedResourceContentState={resolvedResourceContentState}
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
        className="absolute inset-x-2 bottom-2 z-20 rounded-md border border-border bg-background/95 px-3 py-2 text-sm shadow-sm"
      />
      <EditableEmbedLinkDraftForm
        controls={embedControls}
        className="absolute inset-x-2 bottom-2 z-20 flex gap-2 rounded-md border border-border bg-background/95 p-2 shadow-sm"
        errorClassName="self-center whitespace-nowrap text-sm text-destructive"
      />
    </>
  )
}

type CanvasSidebarItemEmbedRuntime = {
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
} & CanvasNoteContentSources

function CanvasEmbedContent({
  allowInnerScroll,
  dropVisualState,
  mode,
  loadingLabel,
  onLinkExternal,
  onMediaLayout,
  onUpload,
  richContentRuntime,
  sourceCanvasId,
  target,
  resolvedResourceContentState,
}: {
  allowInnerScroll: boolean
  dropVisualState?: ReturnType<typeof useEmbedDropTarget>
  mode: 'editable' | 'readonly'
  loadingLabel?: string
  onLinkExternal?: () => void
  onMediaLayout: (layout: EmbedMediaLayout) => void
  onUpload?: () => void
  richContentRuntime: CanvasSidebarItemEmbedRuntime
  sourceCanvasId: SidebarItemId | null
  target: EmbedTarget
  resolvedResourceContentState?: ResourceContentState
}) {
  return (
    <EmbedContent
      target={target}
      sourceItemId={sourceCanvasId}
      mode={mode}
      loadingLabel={loadingLabel}
      onUpload={onUpload}
      onLinkExternal={onLinkExternal}
      onMediaLayout={onMediaLayout}
      allowInnerScroll={allowInnerScroll}
      dropVisualState={dropVisualState}
      renderResourceSurface={createCanvasResourceEmbedSurfaceRenderer(richContentRuntime)}
      resolvedResourceContentState={resolvedResourceContentState}
    />
  )
}

function createCanvasResourceEmbedSurfaceRenderer(
  richContentRuntime: CanvasSidebarItemEmbedRuntime,
): ResourceEmbedSurfaceRenderer {
  return ({ allowInnerScroll, folderChildren, item, onMediaLayout }) => (
    <CanvasResourceEmbedSurface
      item={item}
      allowInnerScroll={allowInnerScroll}
      folderChildren={folderChildren}
      onMediaLayout={onMediaLayout}
      {...richContentRuntime}
    />
  )
}

function EmbedFloatingLabel({
  label,
  missing,
  zoom,
}: {
  label: string
  missing: boolean
  zoom: number
}) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1

  return (
    <div
      data-testid="embed-node-floating-label-frame"
      className="pointer-events-none absolute left-0 top-0 z-20 w-full select-none"
      style={{
        height: EMBED_FLOATING_LABEL_LINE_HEIGHT_PX / safeZoom,
        transform: `translateY(calc(-100% - ${EMBED_FLOATING_LABEL_GAP_PX / safeZoom}px))`,
      }}
    >
      <span
        data-testid="embed-node-floating-label"
        className="absolute bottom-0 left-0 block truncate text-xs font-medium text-muted-foreground"
        style={{
          lineHeight: `${EMBED_FLOATING_LABEL_LINE_HEIGHT_PX}px`,
          transform: `scale(${1 / safeZoom})`,
          transformOrigin: 'left bottom',
          width: `${safeZoom * 100}%`,
        }}
      >
        {missing ? `Warning: ${label}` : label}
      </span>
    </div>
  )
}

function getEmbedFloatingLabel(target: EmbedNodeData['target'], sidebarItemLabel: string) {
  if (target.kind === 'externalUrl') return target.name ?? target.url
  if (target.kind === 'empty') return 'Empty embed'
  return sidebarItemLabel
}

function getLockedAspectRatio({
  target,
  contentItem,
  mediaLayout,
  normalizedData,
  documentAspectRatio,
}: {
  target: EmbedNodeData['target']
  contentItem: AnyItemWithContent | undefined
  mediaLayout: EmbedMediaLayout | null
  normalizedData: EmbedNodeData
  documentAspectRatio: number | null
}) {
  if (mediaLayout?.kind === 'fixedHeight') {
    return undefined
  }

  if (shouldCanvasSidebarItemEmbedUseFreeformResize(contentItem)) {
    return undefined
  }

  const lockedAspectRatio =
    getEmbedMediaAspectRatio(mediaLayout) ?? normalizedData.lockedAspectRatio ?? documentAspectRatio
  if (typeof lockedAspectRatio !== 'number') {
    return undefined
  }

  if (target.kind === 'externalUrl') {
    return lockedAspectRatio
  }

  if (shouldCanvasSidebarItemEmbedLockToMediaAspectRatio(contentItem)) {
    return lockedAspectRatio
  }

  return undefined
}

function getEmbedResizeMinHeight(mediaLayout: EmbedMediaLayout | null) {
  return mediaLayout?.kind === 'fixedHeight' ? mediaLayout.height : EMBED_NODE_MIN_SIZE.height
}

function getEmbedTargetIdentity(target: EmbedTarget): string {
  switch (target.kind) {
    case 'empty':
      return 'empty'
    case 'externalUrl':
      return `external:${target.url}`
    case 'resource':
      return `resource:${target.resourceId}`
  }
  throw new Error('Unknown embed target kind')
}

function getEmbedMediaLayoutIdentity(
  target: EmbedTarget,
  contentItem: AnyItemWithContent | undefined,
): string {
  const targetIdentity = getEmbedTargetIdentity(target)
  if (!contentItem) {
    return targetIdentity
  }

  return [
    targetIdentity,
    contentItem.type,
    'id' in contentItem ? contentItem.id : '',
    'contentType' in contentItem ? contentItem.contentType : '',
    'downloadUrl' in contentItem ? contentItem.downloadUrl : '',
    'previewUrl' in contentItem ? contentItem.previewUrl : '',
  ].join(':')
}
