import { createContext, use, useEffect, useRef, useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { PendingRichEmbedActivationRef } from './use-rich-embed-lifecycle'
import { normalizeEmbedNodeData } from './embed-node-data'
import {
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasViewportRuntime,
} from '../../runtime/providers/canvas-runtime'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import { CANVAS_NODE_MIN_SIZE } from '../shared/canvas-node-resize-constants'
import type { EmbedNodeData } from './embed-node-data'
import { EmbedNoteContent } from './embed-note-content'
import { CanvasFloatingFormattingToolbar } from '../shared/canvas-floating-formatting-toolbar'
import { registerCanvasRichTextFormattingSession } from '../shared/canvas-rich-text-formatting-session'
import { useCanvasEditableNodeSession } from '../shared/use-canvas-editable-node-session'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import {
  getCanvasNodeDefaultTextColor,
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { FileMediaEmbedContent } from '~/features/previews/components/file-media-embed-content'
import { EmbeddedCanvasContent } from './embedded-canvas-content'
import { EmbeddedMapContent } from './embedded-map-content'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasEngine } from '../../react/canvas-engine-context-value'
import { useCanvasViewportZoom } from '../../react/use-canvas-engine'
import type { CanvasNodeComponentProps } from '../canvas-node-types'
import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import {
  EMBED_NODE_MIN_SIZE,
  resolveDefaultEmbedNodeResizeForLockedAspectRatio,
} from './embed-node-size'
import { EmbedContent } from '~/features/embeds/components/embed-content'
import { useEmbedSidebarItemResolver } from '~/features/embeds/context/embed-sidebar-item-resolution'
import type { EmbedSidebarItemState } from '~/features/embeds/context/embed-sidebar-item-resolution'
import { useEmbedDropTarget } from '~/features/embeds/hooks/use-embed-drop-target'
import { useEditableEmbedTargetControls } from '~/features/embeds/hooks/use-editable-embed-target-controls'
import type {
  EmbedMediaLayout,
  EmbedMediaLayoutReporter,
} from '~/features/embeds/utils/embed-media'
import {
  areEmbedMediaLayoutsEqual,
  getEmbedMediaAspectRatio,
} from '~/features/embeds/utils/embed-media'
import { getDefaultDocumentEmbedAspectRatio } from '~/features/embeds/utils/document-embed-layout'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import type { Id } from 'convex/_generated/dataModel'
import type { RefObject } from 'react'

const EMBED_FLOATING_LABEL_GAP_PX = 6
const EMBED_FLOATING_LABEL_LINE_HEIGHT_PX = 16

type CanvasEmbedRichContentContextValue = {
  nodeId: string
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
}

const CanvasEmbedRichContentContext = createContext<CanvasEmbedRichContentContextValue | null>(null)

function persistEmbedTextColor(
  patchNodeData: CanvasDocumentWriter['patchNodeData'],
  id: string,
  textColor: string,
) {
  patchNodeData(new Map([[id, { textColor }]]))
}

function useEmbedNodeMediaLayout({
  canvasEngine,
  contentItemType,
  documentAspectRatio,
  documentWriter,
  id,
  lockedAspectRatio,
  patchNodeData,
  target,
}: {
  canvasEngine: ReturnType<typeof useCanvasEngine>
  contentItemType: AnySidebarItemWithContent['type'] | undefined
  documentAspectRatio: number | null
  documentWriter: CanvasDocumentWriter
  id: string
  lockedAspectRatio: number | null
  patchNodeData: CanvasDocumentWriter['patchNodeData']
  target: EmbedTarget
}) {
  const targetIdentity = getEmbedTargetIdentity(target)
  const [reportedMediaLayout, setReportedMediaLayout] = useState<{
    layout: EmbedMediaLayout
    targetIdentity: string
  } | null>(null)
  const mediaLayout =
    reportedMediaLayout?.targetIdentity === targetIdentity ? reportedMediaLayout.layout : null
  const mediaLayoutRef = useRef<{
    layout: EmbedMediaLayout
    targetIdentity: string
  } | null>(null)
  if (mediaLayoutRef.current?.targetIdentity !== targetIdentity) {
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
    if (
      mediaLayoutRef.current?.targetIdentity === targetIdentity &&
      areEmbedMediaLayoutsEqual(mediaLayoutRef.current.layout, layout)
    ) {
      return
    }

    mediaLayoutRef.current = { layout, targetIdentity }
    setReportedMediaLayout({ layout, targetIdentity })
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
      contentItemType,
      documentAspectRatio,
      documentWriter,
      id,
      lastStoredAspectRatioRef,
      patchNodeData,
    })
  }, [
    canvasEngine,
    contentItemType,
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
  contentItemType,
  documentAspectRatio,
  documentWriter,
  id,
  lastStoredAspectRatioRef,
  patchNodeData,
}: {
  canvasEngine: ReturnType<typeof useCanvasEngine>
  contentItemType: AnySidebarItemWithContent['type'] | undefined
  documentAspectRatio: number | null
  documentWriter: CanvasDocumentWriter
  id: string
  lastStoredAspectRatioRef: RefObject<number | null>
  patchNodeData: CanvasDocumentWriter['patchNodeData']
}) {
  if (contentItemType === SIDEBAR_ITEM_TYPES.canvases) {
    patchStoredEmbedAspectRatio({
      id,
      lastStoredAspectRatioRef,
      lockedAspectRatio: null,
      patchNodeData,
    })
    return
  }

  if (!documentAspectRatio) return

  if (contentItemType === SIDEBAR_ITEM_TYPES.notes) {
    patchStoredEmbedAspectRatio({
      id,
      lastStoredAspectRatioRef,
      lockedAspectRatio: null,
      patchNodeData,
    })
  } else {
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
  lastStoredAspectRatioRef: RefObject<number | null>
  lockedAspectRatio: number | null
  patchNodeData: CanvasDocumentWriter['patchNodeData']
}) {
  if (lastStoredAspectRatioRef.current === lockedAspectRatio) return

  lastStoredAspectRatioRef.current = lockedAspectRatio
  patchNodeData(new Map([[id, { lockedAspectRatio }]]))
}

export function EmbedNode({ id, data, dragging }: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)
  const target = normalizedData.target
  const SidebarItemResolver = useEmbedSidebarItemResolver()

  return (
    <SidebarItemResolver target={target}>
      {(itemState) => (
        <ResolvedEmbedNode
          id={id}
          normalizedData={normalizedData}
          dragging={dragging}
          itemState={itemState}
        />
      )}
    </SidebarItemResolver>
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
  itemState: EmbedSidebarItemState | undefined
}) {
  const target = normalizedData.target
  const resolvedItem = getResolvedEmbedSidebarItemState({ target, itemState })
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
        normalizedData={normalizedData}
        richContentContext={editingRuntime.richContentContext}
        setEmbedMediaLayout={documentRuntime.setEmbedMediaLayout}
        setTarget={documentRuntime.setTarget}
        surfaceRef={editingRuntime.surfaceRef}
        target={target}
      />
    </ResizableNodeWrapper>
  )
}

function getResolvedEmbedSidebarItemState({
  itemState,
  target,
}: {
  itemState: EmbedSidebarItemState | undefined
  target: EmbedTarget
}) {
  const contentItem = itemState?.status === 'available' ? itemState.item : undefined
  const label = getEmbedFloatingLabel(target, itemState?.label ?? 'Embedded item')
  const isUnavailable =
    target.kind === 'sidebarItem' &&
    itemState?.status !== 'available' &&
    itemState?.status !== 'loading'

  return { contentItem, isUnavailable, label }
}

function useEmbedNodeEditingRuntime({
  contentItem,
  id,
  normalizedData,
}: {
  contentItem: AnySidebarItemWithContent | undefined
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
  const isEditing = editableSession.editable && contentItem?.type === SIDEBAR_ITEM_TYPES.notes
  const noteEditor = contentItem?.type === SIDEBAR_ITEM_TYPES.notes ? editor : null
  const showsFormattingToolbar = isEditing && noteEditor !== null
  const defaultTextColor = getCanvasNodeDefaultTextColor(normalizedData)
  const zoom = useCanvasViewportZoom()
  const isEditableEmbed = canEdit && interactiveRenderMode
  const allowInnerScroll = interactiveRenderMode && editableSession.isExclusivelySelected

  useEffect(() => domRuntime.registerNodeSurfaceElement(id, surfaceRef.current), [domRuntime, id])

  const { patchNodeData } = useCanvasDocumentRuntime().documentWriter

  useEffect(() => {
    if (!showsFormattingToolbar || !noteEditor) {
      return
    }

    return registerCanvasRichTextFormattingSession({
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
      nodeId: id,
      isEditing,
      isExclusivelySelected: editableSession.isExclusivelySelected,
      interactiveRenderMode,
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
  contentItem: AnySidebarItemWithContent | undefined
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
    contentItemType: contentItem?.type,
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
  normalizedData,
  richContentContext,
  setEmbedMediaLayout,
  setTarget,
  surfaceRef,
  target,
}: {
  allowInnerScroll: boolean
  canvasId: Id<'sidebarItems'> | null
  contentItem: AnySidebarItemWithContent | undefined
  editableSession: ReturnType<typeof useCanvasEditableNodeSession>
  interactiveRenderMode: boolean
  isEditableEmbed: boolean
  isEditing: boolean
  itemState: EmbedSidebarItemState | undefined
  normalizedData: EmbedNodeData
  richContentContext: CanvasEmbedRichContentContextValue
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
        if (!interactiveRenderMode || contentItem?.type !== SIDEBAR_ITEM_TYPES.notes) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        editableSession.handleDoubleClick(event)
      }}
    >
      <CanvasEmbedRichContentContext.Provider value={richContentContext}>
        <div className="h-full w-full min-h-0 min-w-0">
          {isEditableEmbed ? (
            <EditableCanvasEmbedContent
              rootRef={surfaceRef}
              sourceCanvasId={canvasId}
              target={target}
              setTarget={setTarget}
              onMediaLayout={setEmbedMediaLayout}
              allowInnerScroll={allowInnerScroll}
              resolvedSidebarItemState={itemState}
            />
          ) : (
            <EmbedContent
              target={target}
              sourceItemId={canvasId}
              mode="readonly"
              onMediaLayout={setEmbedMediaLayout}
              allowInnerScroll={allowInnerScroll}
              SidebarItemRenderer={CanvasEmbedRichContentRenderer}
              resolvedSidebarItemState={itemState}
            />
          )}
        </div>
      </CanvasEmbedRichContentContext.Provider>
    </div>
  )
}

function EditableCanvasEmbedContent({
  rootRef,
  sourceCanvasId,
  target,
  setTarget,
  onMediaLayout,
  allowInnerScroll,
  resolvedSidebarItemState,
}: {
  rootRef: RefObject<HTMLElement | null>
  sourceCanvasId: Id<'sidebarItems'> | null
  target: EmbedTarget
  setTarget: (target: EmbedTarget) => Promise<void>
  onMediaLayout: (layout: EmbedMediaLayout) => void
  allowInnerScroll: boolean
  resolvedSidebarItemState?: EmbedSidebarItemState
}) {
  const embedControls = useEditableEmbedTargetControls({ setTarget })

  const dropVisualState = useEmbedDropTarget({
    ref: rootRef,
    enabled: true,
    sourceItemId: sourceCanvasId,
    setTarget: embedControls.setTargetAndCloseDraft,
    uploadFile: embedControls.uploadFile,
  })

  return (
    <>
      <EmbedContent
        target={target}
        sourceItemId={sourceCanvasId}
        mode="editable"
        onUpload={embedControls.openFilePicker}
        onLinkExternal={embedControls.openLinkDraft}
        onMediaLayout={onMediaLayout}
        allowInnerScroll={allowInnerScroll}
        dropVisualState={target.kind === 'empty' ? dropVisualState : undefined}
        SidebarItemRenderer={CanvasEmbedRichContentRenderer}
        resolvedSidebarItemState={resolvedSidebarItemState}
      />
      <input
        ref={embedControls.fileInputRef}
        type="file"
        aria-label="Embed file upload"
        className="hidden"
        onChange={embedControls.handleFileInputChange}
      />
      {embedControls.isUploading || embedControls.uploadError ? (
        <div className="absolute inset-x-2 bottom-2 z-20 rounded-md border border-border bg-background/95 px-3 py-2 text-sm shadow-sm">
          {embedControls.uploadError ? (
            <span className="text-destructive">{embedControls.uploadError}</span>
          ) : (
            <span className="text-muted-foreground">Uploading...</span>
          )}
        </div>
      ) : null}
      {embedControls.linkDraftOpen ? (
        <form
          className="absolute inset-x-2 bottom-2 z-20 flex gap-2 rounded-md border border-border bg-background/95 p-2 shadow-sm"
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
            <span className="self-center whitespace-nowrap text-sm text-destructive">
              {embedControls.linkError}
            </span>
          ) : null}
        </form>
      ) : null}
    </>
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

function CanvasEmbedRichContentRenderer({
  item,
  allowInnerScroll = true,
  onMediaLayout,
}: {
  item: AnySidebarItemWithContent
  allowInnerScroll?: boolean
  onMediaLayout?: EmbedMediaLayoutReporter
}) {
  const context = use(CanvasEmbedRichContentContext)
  if (!context) return null

  return (
    <EmbedRichContent
      {...context}
      contentItem={item}
      allowInnerScroll={allowInnerScroll}
      onMediaLayout={onMediaLayout}
    />
  )
}

function EmbedRichContent({
  allowInnerScroll,
  nodeId,
  contentItem,
  isEditing,
  isExclusivelySelected,
  interactiveRenderMode,
  onActivated,
  onEditorChange,
  onMediaLayout,
  pendingActivationRef,
  textColor,
}: {
  allowInnerScroll: boolean
  nodeId: string
  contentItem: AnySidebarItemWithContent
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  onMediaLayout?: EmbedMediaLayoutReporter
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
}): React.ReactElement | null {
  if (contentItem.type === SIDEBAR_ITEM_TYPES.notes) {
    return (
      <EmbedNoteContent
        note={contentItem}
        editable={isEditing}
        isExclusivelySelected={isExclusivelySelected}
        onActivated={onActivated}
        onCanvasEditorChange={onEditorChange}
        pendingActivationRef={pendingActivationRef}
        textColor={textColor}
      />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.canvases) {
    return interactiveRenderMode ? (
      <EmbeddedCanvasContent
        nodeId={nodeId}
        canvasId={contentItem._id}
        previewUrl={contentItem.previewUrl}
        alt={contentItem.name}
      />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return interactiveRenderMode ? (
      <EmbeddedMapContent nodeId={nodeId} map={contentItem} />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.files) {
    return (
      <FileMediaEmbedContent
        downloadUrl={contentItem.downloadUrl}
        contentType={contentItem.contentType}
        previewUrl={contentItem.previewUrl}
        name={contentItem.name}
        allowInnerScroll={allowInnerScroll}
        onMediaLayout={onMediaLayout}
      />
    )
  }

  const hasScrollableContent = contentItem.type === SIDEBAR_ITEM_TYPES.folders

  return (
    <div
      className={cn(
        'h-full overflow-hidden',
        hasScrollableContent && interactiveRenderMode && isExclusivelySelected && 'nowheel',
      )}
    >
      <SidebarItemPreviewContent item={contentItem} />
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
  contentItem: AnySidebarItemWithContent | undefined
  mediaLayout: EmbedMediaLayout | null
  normalizedData: EmbedNodeData
  documentAspectRatio: number | null
}) {
  if (mediaLayout?.kind === 'fixedHeight') {
    return undefined
  }

  if (
    contentItem?.type === SIDEBAR_ITEM_TYPES.notes ||
    contentItem?.type === SIDEBAR_ITEM_TYPES.canvases
  ) {
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

  if (contentItem?.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return lockedAspectRatio
  }

  if (contentItem?.type === SIDEBAR_ITEM_TYPES.files) {
    return lockedAspectRatio
  }

  return undefined
}

function getEmbedResizeMinHeight(mediaLayout: EmbedMediaLayout | null) {
  return mediaLayout?.kind === 'fixedHeight' ? mediaLayout.height : EMBED_NODE_MIN_SIZE.height
}

function getEmbedTargetIdentity(target: EmbedTarget) {
  switch (target.kind) {
    case 'empty':
      return 'empty'
    case 'externalUrl':
      return `external:${target.url}`
    case 'sidebarItem':
      return `sidebar:${target.sidebarItemId}`
  }
}
